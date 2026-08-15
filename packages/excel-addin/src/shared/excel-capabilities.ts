export const EXCEL_API_VERSIONS = ['1.1', '1.2', '1.3', '1.4', '1.9'];

export function supportsNativeFillDown(requirementSets: {
  [set: string]: boolean;
}): boolean {
  return requirementSets['ExcelApi 1.9'] === true;
}
