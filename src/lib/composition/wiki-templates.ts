import { RODDER_WIKI_TEMPLATES } from '$lib/feature/rodder/public/templates.js'
import { CORE_WIKI_TEMPLATES, createTemplateRegistry } from '$lib/templates/registry.js'

export const WIKI_TEMPLATE_REGISTRY = createTemplateRegistry(CORE_WIKI_TEMPLATES, RODDER_WIKI_TEMPLATES)
