import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";
import ts from "typescript";


const root = process.cwd();
const sourceRoots = ["packages/shared/src", "packages/server/src", "packages/web/src", "packages/electron/src"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const reviewThreshold = 10;
const failureThreshold = 16;
const fileReviewThreshold = 300;
const fileFailureThreshold = 350;
const fileLengthExclusions = new Set(["packages/web/src/i18n/messages.ts"]);
const failuresOnly = process.argv.includes("--failures-only");


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
    const longFiles = [];

    for (const path of files) {
        const content = await readFile(path, "utf8");
        const lineCount = content === "" ? 0 : content.split(/\r\n|\r|\n/).length - (/(\r\n|\r|\n)$/.test(content) ? 1 : 0);
        const relativePath = relative(root, path).replaceAll("\\", "/");
        const sourceFile = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true,
            path.endsWith(".tsx") || path.endsWith(".jsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

        if (!fileLengthExclusions.has(relativePath) && lineCount >= fileReviewThreshold)
            longFiles.push({ path: relativePath, lineCount });


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
    for (const violation of violations.filter(({ score }) => !failuresOnly || score >= failureThreshold))
        console.log(`${violation.path}:${violation.line} ${violation.name} ${violation.score}`);

    const failures = violations.filter(({ score }) => score >= failureThreshold);
    const reviewOnly = violations.length - failures.length;
    console.log(failuresOnly
        ? `${failures.length} function(s) above the complexity ceiling of ${failureThreshold - 1}`
        : `${failures.length} function(s) above the complexity ceiling of ${failureThreshold - 1}; ${reviewOnly} additional function(s) in the review range ${reviewThreshold}-${failureThreshold - 1}`);
    if (failures.length)

        process.exitCode = 1;

    longFiles.sort((left, right) => right.lineCount - left.lineCount || left.path.localeCompare(right.path));
    for (const file of longFiles.filter(({ lineCount }) => !failuresOnly || lineCount >= fileFailureThreshold)) {
        const level = file.lineCount >= fileFailureThreshold ? "FAIL" : "WARN";
        console.log(`${level} ${file.path} ${file.lineCount} lines`);
    }

    const oversizedFiles = longFiles.filter(({ lineCount }) => lineCount >= fileFailureThreshold);
    console.log(failuresOnly
        ? `${oversizedFiles.length} file(s) at or above ${fileFailureThreshold} lines`
        : `${oversizedFiles.length} file(s) at or above ${fileFailureThreshold} lines; ${longFiles.length - oversizedFiles.length} additional file(s) in the review range ${fileReviewThreshold}-${fileFailureThreshold - 1}`);
    if (oversizedFiles.length)
        process.exitCode = 1;
}


await main();
