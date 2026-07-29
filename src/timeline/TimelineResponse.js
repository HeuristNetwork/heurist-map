export const TIMELINE_FORMAT = 'heurist-timeline';
export const TIMELINE_VERSION = 1;

/**
 * Reserved Phase 2 timeline response shape. Timeline loading/rendering is not
 * connected until the dedicated timeline phase.
 */
export function isTimelineResponse(value) {
  return Boolean(
    value
    && value.format === TIMELINE_FORMAT
    && value.version === TIMELINE_VERSION
    && Array.isArray(value.items)
    && value.meta
    && typeof value.meta === 'object'
  );
}
