// Provider connector registry. Each connector is an isolated, versioned module so a provider
// integration can fail or be swapped without touching the concierge agent or booking service.
import * as cab from './cab.js';
import * as food from './food.js';
import * as stay from './stay.js';
import * as experience from './experience.js';

export const connectors = { cab, food, stay, experience };
export const CATEGORIES = Object.keys(connectors);

export function connectorFor(category) {
  const c = connectors[category];
  if (!c) throw new Error(`No connector for category ${category}`);
  return c;
}

export { remember, recall } from './common.js';
