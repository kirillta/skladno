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


export default {
    rules: {
        "conditional-braces": conditionalBraces,
        "no-accessible-label-selector": noAccessibleLabelSelector,
        "no-production-intl-provider": noProductionIntlProvider,
        "no-untranslated-ui-copy": noUntranslatedUiCopy,
    },
};
