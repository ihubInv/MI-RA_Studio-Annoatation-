/**
 * Built-in Custom Template examples.
 *
 * These are starter documents only. They are not assigned to datasets and do
 * not replace Standard Video Annotation (`/annotate/video/:itemId`).
 */
import type { VideoTemplateDocument } from '../document'
import objectDetection from './object-detection.json'
import vehicleTracking from './vehicle-tracking.json'
import humanPose from './human-pose.json'
import humanActivity from './human-activity.json'
import surveillance from './surveillance.json'
import trafficAnalysis from './traffic-analysis.json'
import semanticSegmentation from './semantic-segmentation.json'
import instanceSegmentation from './instance-segmentation.json'
import signLanguage from './sign-language.json'
import sportsAnalysis from './sports-analysis.json'
import medicalVideo from './medical-video.json'
import customMultimodal from './custom-multimodal.json'

export interface BuiltinVideoTemplateExample {
  id: string
  title: string
  summary: string
  document: VideoTemplateDocument
}

function example(
  id: string,
  summary: string,
  raw: unknown,
): BuiltinVideoTemplateExample {
  const document = raw as VideoTemplateDocument
  return {
    id,
    title: document.template.name,
    summary,
    document,
  }
}

export const BUILTIN_VIDEO_TEMPLATE_EXAMPLES: BuiltinVideoTemplateExample[] = [
  example('object-detection', 'Boxes for people, vehicles, animals, and generic objects.', objectDetection),
  example('vehicle-tracking', 'Vehicle identities with interpolation, trajectories, and MOT export.', vehicleTracking),
  example('human-pose', 'Person boxes and skeleton keypoints.', humanPose),
  example('human-activity', 'People plus walk / run / sit temporal actions.', humanActivity),
  example('surveillance', 'People, bags, zones, and intrusion-style events.', surveillance),
  example('traffic-analysis', 'Roadside vehicles, lanes, and traffic events.', trafficAnalysis),
  example('semantic-segmentation', 'Class regions with polygons, brushes, and masks.', semanticSegmentation),
  example('instance-segmentation', 'Per-instance masks for people and vehicles.', instanceSegmentation),
  example('sign-language', 'Signer pose plus gloss events and a speech track.', signLanguage),
  example('sports-analysis', 'Players, ball, actions, and marking relationships.', sportsAnalysis),
  example('medical-video', 'Anatomical regions, instruments, and procedure phases.', medicalVideo),
  example('custom-multimodal', 'Objects, pose, masks, events, actions, relations, and audio together.', customMultimodal),
]

export function builtinExampleById(id: string): BuiltinVideoTemplateExample | undefined {
  return BUILTIN_VIDEO_TEMPLATE_EXAMPLES.find((item) => item.id === id)
}

export function stringifyBuiltinExample(item: BuiltinVideoTemplateExample): string {
  return `${JSON.stringify(item.document, null, 2)}\n`
}
