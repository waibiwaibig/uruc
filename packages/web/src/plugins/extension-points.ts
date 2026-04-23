import {
  INTRO_CARD_TARGET,
  LOCATION_PAGE_TARGET,
  NAV_ENTRY_TARGET,
  PAGE_ROUTE_TARGET,
  RUNTIME_SLICE_TARGET,
  defineExtensionPoint,
  introCardSchema,
  locationPageSchema,
  navEntrySchema,
  pageRouteSchema,
  runtimeSliceSchema,
  type ExtensionTarget,
} from '@uruc/plugin-sdk/frontend';

export const extensionRegistry = {
  [PAGE_ROUTE_TARGET]: defineExtensionPoint({
    id: PAGE_ROUTE_TARGET,
    version: 'v1',
    schema: pageRouteSchema,
  }),
  [LOCATION_PAGE_TARGET]: defineExtensionPoint({
    id: LOCATION_PAGE_TARGET,
    version: 'v1',
    schema: locationPageSchema,
  }),
  [NAV_ENTRY_TARGET]: defineExtensionPoint({
    id: NAV_ENTRY_TARGET,
    version: 'v1',
    schema: navEntrySchema,
  }),
  [INTRO_CARD_TARGET]: defineExtensionPoint({
    id: INTRO_CARD_TARGET,
    version: 'v1',
    schema: introCardSchema,
  }),
  [RUNTIME_SLICE_TARGET]: defineExtensionPoint({
    id: RUNTIME_SLICE_TARGET,
    version: 'v1',
    schema: runtimeSliceSchema,
  }),
} as const satisfies Record<ExtensionTarget, ReturnType<typeof defineExtensionPoint>>;

export type FrontendExtensionPoint = typeof extensionRegistry[keyof typeof extensionRegistry];
