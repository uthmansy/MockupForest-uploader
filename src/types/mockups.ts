/* -------------------------------------------------------------------------- */
/*                                   TYPES                                   */
/* -------------------------------------------------------------------------- */

export interface Group {
  id: number;
  name: string;
}

export interface Layer {
  id: number;
  name: string;
  height: number;
  width: number;
  design?: string | null;
  uvPass?: string;
  mask: string;
  zIndex: number;
  groupId?: number | null;
  crop: { x: number; y: number };
  croppedAreaPixels?: any | null;
  croppedArea?: any | null;
  zoom?: number;
  type: "design" | "color";
  color?: string;
  aspectRatio: number;
  noiseThreshold?: number;
  highlightsIntensity: undefined;
  shadowIntensity: undefined;
}

export interface GlobalSettings {
  name: string;
  base: string;
  uv: string;
  brightness: number;
  contrast: number;
  highlightsIntensity: number;
  uvTexture?: null;
  baseTexture?: null;
  canvasWidth: number;
  canvasHeight: number;
}

export interface LayersState {
  layers: Layer[];
  groups: Group[];
  global: GlobalSettings;
  loading: boolean;
}
