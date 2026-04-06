/** @type {import('eslint').Rule.RuleModule} */

function getHandlerExpression(attribute) {
	if (!attribute.value || !Array.isArray(attribute.value)) return null
	const mustache = attribute.value.find(v => v.type === 'SvelteMustacheTag')
	return mustache?.expression ?? null
}

function getHandlerBody(expression) {
	if (expression.type === 'ArrowFunctionExpression' && expression.body.type === 'BlockStatement' && expression.body.body.length > 0) {
		return expression.body.body[0]
	}
	if (expression.type === 'FunctionExpression' && expression.body.body.length > 0) {
		return expression.body.body[0]
	}
	return null
}

function isDisabledIdentifier(node) {
	return node.type === 'Identifier' && /disabled/i.test(node.name)
}

function isDisabledGuard(statement) {
	if (statement.type !== 'IfStatement') return false
	const test = statement.test

	if (test.type === 'UnaryExpression' && test.operator === '!') {
		return isDisabledIdentifier(test.argument)
	}

	if (isDisabledIdentifier(test) && statement.consequent) {
		const consequent = statement.consequent
		if (consequent.type === 'ReturnStatement') return true
		if (consequent.type === 'BlockStatement'
			&& consequent.body.length === 1
			&& consequent.body[0].type === 'ReturnStatement') return true
	}

	return false
}

function getUnguardedBody(ifStatement, source) {
	const test = ifStatement.test

	if (test.type === 'UnaryExpression' && test.operator === '!') {
		const consequent = ifStatement.consequent
		if (consequent.type === 'BlockStatement') {
			return consequent.body.map(s => source.getText(s)).join('\n')
		}
		return source.getText(consequent)
	}

	return null
}

export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow onclick handlers that guard against disabled state — use native disabled attribute instead',
		},
		fixable: 'code',
		messages: {
			noDisabledGuard: 'Remove the disabled guard from onclick — the native `disabled` attribute already prevents clicks.',
		},
		schema: [],
	},
	create(context) {
		return {
			SvelteStartTag(node) {
				const attributes = node.attributes ?? []

				const disabledAttribute = attributes.find(
					a => (a.type === 'SvelteAttribute' || a.type === 'SvelteDirective')
						&& (a.key?.name === 'disabled'),
				)
				if (!disabledAttribute) return

				const onclickAttribute = attributes.find(
					a => (a.type === 'SvelteAttribute' && a.key?.name === 'onclick'),
				)
				if (!onclickAttribute) return

				const handler = getHandlerExpression(onclickAttribute)
				if (!handler) return

				const body = getHandlerBody(handler)
				if (!body) return

				if (isDisabledGuard(body)) {
					context.report({
						node: onclickAttribute,
						messageId: 'noDisabledGuard',
						fix(fixer) {
							const source = context.sourceCode
							const ifStatement = body
							const test = ifStatement.test

							// Pattern B: if (disabled) return; — just remove the if statement
							if (test.type !== 'UnaryExpression' && isDisabledIdentifier(test)) {
								const tokenAfter = source.getTokenAfter(ifStatement, { includeComments: true })
								const end = tokenAfter ? tokenAfter.range[0] : ifStatement.range[1]
								return fixer.removeRange([ifStatement.range[0], end])
							}

							// Pattern A: if (!disabled) { body } — unwrap the body
							const replacement = getUnguardedBody(ifStatement, source)
							if (!replacement) return null

							return fixer.replaceText(ifStatement, replacement)
						},
					})
				}
			},
		}
	},
}
