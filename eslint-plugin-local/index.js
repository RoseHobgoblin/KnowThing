import noCnStaticOnly from './no-cn-static-only.js'
import preferDerivedBy from './prefer-derived-by.js'
import preferCnForDynamicClasses from './prefer-cn-for-dynamic-classes.js'
import noConsoleServer from './no-console-server.js'
import noSpreadStateArray from './no-spread-state-array.js'
import noInlineImportType from './no-inline-import-type.js'
import preferStyleDirective from './prefer-style-directive.js'
import noOnclickDisabledGuard from './no-onclick-disabled-guard.js'
import noDynamicTailwindClass from './no-dynamic-tailwind-class.js'
import noPxArbitraryTailwind from './no-px-arbitrary-tailwind.js'

const plugin = {
	rules: {
		'no-cn-static-only': noCnStaticOnly,
		'prefer-derived-by': preferDerivedBy,
		'prefer-cn-for-dynamic-classes': preferCnForDynamicClasses,
		'no-console-server': noConsoleServer,
		'no-spread-state-array': noSpreadStateArray,
		'no-inline-import-type': noInlineImportType,
		'prefer-style-directive': preferStyleDirective,
		'no-onclick-disabled-guard': noOnclickDisabledGuard,
		'no-dynamic-tailwind-class': noDynamicTailwindClass,
		'no-px-arbitrary-tailwind': noPxArbitraryTailwind,
	},
}

export default plugin
