import type { TemplateToolId } from './catalog'

export const TEMPLATE_TOOL_LABELS: Record<TemplateToolId, string> = {
  bounding_box: 'Bounding box',
  rotated_box: 'Rotated box',
  polygon: 'Polygon',
  polyline: 'Polyline',
  point: 'Point',
  ellipse: 'Ellipse',
  keypoint: 'Keypoint',
  skeleton: 'Skeleton',
  brush: 'Brush',
  mask: 'Mask',
  cuboid: 'Cuboid',
  tracking: 'Tracking',
  event: 'Event',
  action: 'Action',
  relationship: 'Relationship',
  trajectory: 'Trajectory',
}
