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


function literalString(node) {
    if (node?.type === "Literal" && typeof node.value === "string")
        return node.value;

    if (node?.type === "TemplateLiteral" && node.expressions.length === 0)
        return node.quasis[0]?.value.cooked ?? "";

    return undefined;
}


const noUntranslatedUiCopy = {
    meta: {
        type: "problem",
        docs: {
            description: "Require application-owned visible and accessible copy to resolve through the ICU catalog.",
        },
        messages: {
            untranslatedCopy: "Move application-owned UI copy to the typed ICU catalog and format it with a semantic message ID.",
        },
        schema: [{
            type: "object",
            properties: {
                allowedLiterals: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                    uniqueItems: true,
                },
            },
            additionalProperties: false,
        }],
    },

    create(context) {
        const allowedLiterals = new Set(context.options[0]?.allowedLiterals ?? []);
        const visibleAttributes = new Set([
            "alt",
            "aria-label",
            "description",
            "hint",
            "label",
            "message",
            "placeholder",
            "title",
        ]);


        function isApplicationCopy(value) {
            const copy = value.trim();

            return /\p{L}/u.test(copy) && !allowedLiterals.has(copy);
        }


        function reportIfApplicationCopy(node, value) {
            if (isApplicationCopy(value))
                context.report({
                    node,
                    messageId: "untranslatedCopy",
                });
        }


        return {
            JSXText(node) {
                reportIfApplicationCopy(node, node.value);
            },

            JSXExpressionContainer(node) {
                if (node.parent.type === "JSXAttribute")
                    return;

                const value = literalString(node.expression);

                if (value !== undefined)
                    reportIfApplicationCopy(node, value);
            },

            JSXAttribute(node) {
                if (node.name.type !== "JSXIdentifier" || !visibleAttributes.has(node.name.name) || !node.value)
                    return;

                if (node.value.type === "Literal") {
                    const value = literalString(node.value);

                    if (value !== undefined)
                        reportIfApplicationCopy(node.value, value);

                    return;
                }

                if (node.value.type !== "JSXExpressionContainer")
                    return;

                const value = literalString(node.value.expression);

                if (value !== undefined)
                    reportIfApplicationCopy(node.value, value);
            },
        };
    },
};


const noProductionIntlProvider = {
    meta: {
        type: "problem",
        docs: {
            description: "Keep production components on the application-level locale provider.",
        },
        messages: {
            nestedProvider: "Production components must consume the application I18nProvider instead of creating another IntlProvider.",
        },
        schema: [],
    },

    create(context) {
        return {
            JSXOpeningElement(node) {
                if (node.name.type === "JSXIdentifier" && node.name.name === "IntlProvider")
                    context.report({
                        node,
                        messageId: "nestedProvider",
                    });
            },
        };
    },
};


const noAccessibleLabelSelector = {
    meta: {
        type: "problem",
        docs: {
            description: "Prevent localized accessible names from becoming DOM selectors.",
        },
        messages: {
            localizedSelector: "Use a ref or stable data attribute instead of selecting an element by its localized accessible label.",
        },
        schema: [],
    },

    create(context) {
        const selectorMethods = new Set([
            "closest",
            "matches",
            "querySelector",
            "querySelectorAll",
        ]);

        return {
            CallExpression(node) {
                if (node.callee.type !== "MemberExpression" || node.callee.computed || node.callee.property.type !== "Identifier" || !selectorMethods.has(node.callee.property.name))
                    return;

                const selector = literalString(node.arguments[0]);

                if (selector?.includes("aria-label"))
                    context.report({
                        node: node.arguments[0],
                        messageId: "localizedSelector",
                    });
            },
        };
    },
};


const twoBlankLinesBetweenDeclarations = {
    meta: {
        type: "layout",
        docs: {
            description: "Require two blank lines around functions, interfaces, classes, and class members.",
        },
        fixable: "whitespace",
        messages: {
            twoBlankLines: "Expected two blank lines between declarations.",
        },
        schema: [],
    },

    create(context) {
        const sourceCode = context.sourceCode;
        const declarationTypes = new Set([
            "ClassDeclaration",
            "FunctionDeclaration",
            "TSDeclareFunction",
            "TSInterfaceDeclaration",
        ]);
        const memberTypes = new Set([
            "MethodDefinition",
            "PropertyDefinition",
            "TSAbstractMethodDefinition",
            "TSAbstractPropertyDefinition",
        ]);


        function unwrap(node) {
            return node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration"
                ? node.declaration ?? node
                : node;
        }


        function needsPadding(previous, next, members = false) {
            if (members)
                return true;

            const previousDeclaration = unwrap(previous);
            const nextDeclaration = unwrap(next);
            if (previousDeclaration.type === "VariableDeclaration" && nextDeclaration.type === "VariableDeclaration" && previousDeclaration.kind === "const" && nextDeclaration.kind === "const")
                return false;

            return declarationTypes.has(previousDeclaration.type) || declarationTypes.has(nextDeclaration.type);
        }


        function checkPairs(nodes, members = false) {
            for (let index = 0; index < nodes.length - 1; index++) {
                const previous = nodes[index];
                const next = nodes[index + 1];
                if (!memberTypes.has(previous.type) && !memberTypes.has(next.type) && !needsPadding(previous, next, members))
                    continue;

                const previousToken = sourceCode.getLastToken(previous);
                const nextToken = sourceCode.getFirstToken(next);
                const comments = sourceCode.getTokensBetween(previousToken, nextToken, { includeComments: true }).filter((token) => token.type === "Block" || token.type === "Line");
                const boundaryToken = comments[0]?.loc.start.line > previousToken.loc.end.line ? comments[0] : nextToken;
                const blankLines = boundaryToken.loc.start.line - previousToken.loc.end.line - 1;
                if (blankLines === 2)
                    continue;

                context.report({
                    node: next,
                    messageId: "twoBlankLines",
                    fix(fixer) {
                        if (boundaryToken === nextToken && comments.length > 0)
                            return null;

                        const lineStart = sourceCode.text.lastIndexOf("\n", boundaryToken.range[0] - 1) + 1;
                        const indentation = /^[ \t]*/u.exec(sourceCode.text.slice(lineStart, boundaryToken.range[0]))?.[0] ?? "";
                        const newline = sourceCode.text.includes("\r\n") ? "\r\n" : "\n";
                        return fixer.replaceTextRange(
                            [previousToken.range[1], boundaryToken.range[0]],
                            `${newline}${newline}${newline}${indentation}`,
                        );
                    },
                });
            }
        }


        return {
            Program(node) {
                checkPairs(node.body);
            },

            BlockStatement(node) {
                checkPairs(node.body);
            },

            ClassBody(node) {
                checkPairs(node.body, true);
            },
        };
    },
};


export default {
    rules: {
        "conditional-braces": conditionalBraces,
        "no-accessible-label-selector": noAccessibleLabelSelector,
        "no-production-intl-provider": noProductionIntlProvider,
        "no-untranslated-ui-copy": noUntranslatedUiCopy,
        "two-blank-lines-between-declarations": twoBlankLinesBetweenDeclarations,
    },
};
