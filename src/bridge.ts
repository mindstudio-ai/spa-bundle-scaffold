import { useMemo } from 'react';
import { testData } from './testData';

interface CustomWindow extends Window {
  onPost: (values: { [variableName: string]: any }) => void;
  uploadFile: (file: File) => Promise<string>;
  vars?: { [variableName: string]: any };
}
declare const window: CustomWindow;

export const submit = (values: { [variableName: string]: any }) => {
  try {
    window.onPost(values);
  } catch (err) {
    alert(`Submitted!`);
  }
}

export const uploadFile = async (file: File): Promise<string> => {
  try {
    return await window.uploadFile(file);
  } catch (err) {
    alert('File upload not available in preview mode');
    return '';
  }
}

export const useTemplateVariables = (): { [variableName: string]: any } => {
  return useMemo(() => {
    if (window.vars && typeof window.vars === 'object') {
      return window.vars;
    }
    return testData;
  }, []);
};
