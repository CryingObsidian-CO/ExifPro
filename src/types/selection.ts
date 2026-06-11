export enum SelectionMethod {
  BlurDetection = 'BlurDetection',
  OnnxDetection = 'OnnxDetection',
}

export enum BlurAlgorithm {
  LaplacianVariance = 'LaplacianVariance',
  Tenengrad = 'Tenengrad',
  Brenner = 'Brenner',
}

export interface SelectionResult {
  file_path: string;
  file_name: string;
  score: number;
  score_details: Array<[SelectionMethod, number]>;
  passed: boolean;
  eliminated_by: SelectionMethod[];
}

export interface SelectionRating {
  file_path: string;
  stars: number;
}
