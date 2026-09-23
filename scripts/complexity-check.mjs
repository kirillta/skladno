import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";
import ts from "typescript";


const root = process.cwd();
const sourceRoots = ["packages/shared/src", "packages/server/src", "packages/web/src", "packages/electron/src"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const reviewThreshold = 10;
const failureThreshold = 16;


async function sourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
        const path = join(directory, entry.name);

        if (entry.isDirectory())
            return sourceFiles(path);

        return extensions.has(path.slice(path.lastIndexOf("."))) && !/\.test\.[^.]+$/.test(entry.name)
            ? [path]
            : [];
    }));

    return files.flat();
}


function functionName(node) {
    if (node.name)
        return node.name.getText();

    if (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node))
        return node.name.getText();

    return "<anonymous>";
}


function scoreFunction(node, sourceFile) {
    let score = 0;


    function visit(current, nesting) {
        if (current !== node && ts.isFunctionLike(current))
            return;

        const isElseIf = ts.isIfStatement(current) && ts.isIfStatement(current.parent) && current.parent.elseStatement === current;
        const structural = ts.isForStatement(current) || ts.isForInStatement(current)
            || ts.isForOfStatement(current) || ts.isWhileStatement(current) || ts.isDoStatement(current)
            || ts.isCatchClause(current) || ts.isConditionalExpression(current) || ts.isSwitchStatement(current);
        const nextNesting = structural || ts.isIfStatement(current) ? nesting + 1 : nesting;

        if (structural)
            score += 1 + nesting;

        if (ts.isIfStatement(current)) {
            score += isElseIf ? 1 : 1 + nesting;
            if (current.elseStatement && !ts.isIfStatement(current.elseStatement))
                score += 1;
        }

        if (ts.isBinaryExpression(current) && (current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
            || current.operatorToken.kind === ts.SyntaxKind.BarBarToken
            || current.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
            const parent = current.parent;
            if (!ts.isBinaryExpression(parent) || parent.operatorToken.kind !== current.operatorToken.kind)
                score += 1;
        }

        ts.forEachChild(current, (child) => visit(child, nextNesting));
    }


    visit(node.body ?? node, 0);
    return { score, line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1 };
}


async function main() {
    const files = (await Promise.all(sourceRoots.map((directory) => sourceFiles(join(root, directory))))).flat();
    const violations = [];

    for (const path of files) {
        const sourceFile = ts.createSourceFile(path, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true,
            path.endsWith(".tsx") || path.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);


        function inspect(node) {
            if (ts.isFunctionLike(node) && node.body) {
                const { score, line } = scoreFunction(node, sourceFile);
                if (score >= reviewThreshold)
                    violations.push({ path: relative(root, path).replaceAll("\\", "/"), line, name: functionName(node), score });
            }

            ts.forEachChild(node, inspect);
        }


        inspect(sourceFile);
    }

    violations.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
    for (const violation of violations)
        console.log(`${violation.path}:${violation.line} ${violation.name} ${violation.score}`);

    const failures = violations.filter(({ score }) => score >= failureThreshold);
    const reviewOnly = violations.length - failures.length;
    console.log(`${failures.length} function(s) above the complexity ceiling of ${failureThreshold - 1}; ${reviewOnly} additional function(s) in the review range ${reviewThreshold}-${failureThreshold - 1}`);
    if (failures.length)

        process.exitCode = 1;
}


await main();
