const conditionalBraces = {
    meta: {
        type: "layout",
        docs: {
            description: "Omit braces for concise conditionals and require them consistently for multi-statement branches.",
        },
        fixable: "whitespace",
        messages: {
            omitBraces: "Omit braces around a single-statement conditional body.",
            requireBraces: "Use braces for every branch when an if/else branch contains multiple statements.",
        },
        schema: [],
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const unsafeWithoutBlock = new Set([
            "BlockStatement",
            "ClassDeclaration",
            "FunctionDeclaration",
            "IfStatement",
            "LexicalDeclaration",
            "VariableDeclaration",
        ]);


        function branchesFor(node) {
            const branches = [];
            let current = node;

            while (current.type === "IfStatement") {
                branches.push(current.consequent);

                if (!current.alternate)
                    return branches;

                current = current.alternate;
            }

            branches.push(current);

            return branches;
        }


        function canOmitBraces(branch) {
            return branch.type !== "BlockStatement"
                || (
                    branch.body.length === 1
                    && !unsafeWithoutBlock.has(branch.body[0].type)
                );
        }


        function removeBraces(fixer, branch) {
            if (sourceCode.getCommentsInside(branch).length > 0)
                return null;

            const statement = branch.body[0];
            const openingBrace = sourceCode.getFirstToken(branch);
            const closingBrace = sourceCode.getLastToken(branch);
            const indentation = " ".repeat(statement.loc.start.column - openingBrace.loc.start.column);

            return [
                fixer.replaceTextRange(
                    [openingBrace.range[0], statement.range[0]],
                    indentation,
                ),
                fixer.removeRange([statement.range[1], closingBrace.range[1]]),
            ];
        }


        return {
            IfStatement(node) {
                if (node.parent.type === "IfStatement" && node.parent.alternate === node)
                    return;

                const branches = branchesFor(node);
                const requiresBraces = branches.some((branch) => !canOmitBraces(branch));

                for (const branch of branches) {
                    if (requiresBraces && branch.type === "BlockStatement")
                        continue;

                    if (!requiresBraces && branch.type !== "BlockStatement")
                        continue;

                    context.report({
                        node: branch,
                        messageId: requiresBraces ? "requireBraces" : "omitBraces",
                        fix: requiresBraces
                            ? undefined
                            : (fixer) => removeBraces(fixer, branch),
                    });
                }
            },
        };
    },
};


export default {
    rules: {
        "conditional-braces": conditionalBraces,
    },
};
