/**
 * Simulation script public surface.
 *
 * This file is a compatibility shim that keeps the stable `./script` module
 * path while the implementation is split into DTO/types and validators.
 *
 * @module
 */

export * from './script-types';
export * from './script-validators';
