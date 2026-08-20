/**
 * Public page-data contract for Rodder detail consumers.
 *
 * The implementation derives this union from its query return types. Re-exporting
 * it as a type keeps that precision while ensuring browser code depends on the
 * feature contract rather than the server module's location. This dependency is
 * erased during TypeScript compilation.
 */
export type { RodderDetailData } from '../server/detail.server.js'
