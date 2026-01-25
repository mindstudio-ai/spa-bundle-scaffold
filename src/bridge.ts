import { useMemo } from 'react';
import { testData } from './testData';

interface CustomWindow extends Window {
  onPost: (values: { [variableName: string]: any }) => void;
  onUpdate: (values: { [variableName: string]: any }) => void;
  uploadFile: (file: File) => Promise<string>;
  vars?: { [variableName: string]: any };
}
declare const window: CustomWindow;

export const submit = (values: { [variableName: string]: any }) => {
  try {
    window.onPost(values);
  } catch (err) {
    if (window.location !== window.parent.location) {
      window.parent.postMessage({ action: 'bridgeDebug', value: `Submitted` }, '*');
    } else {
      alert('[Debug] Submitted');
    }
  }
}

// Provided because it semantically makes more sense to the AI models when using
// in workbench mode. In this mode it does a merge instead of a set.
export const update = (values: { [variableName: string]: any }) => {
  try {
    window.onUpdate(values);
  } catch (err) {
    if (window.location !== window.parent.location) {
      window.parent.postMessage({ action: 'bridgeDebug', value: `Update` }, '*');
    } else {
      alert('[Debug] Updated');
    }
  }
}

export const uploadFile = async (file: File): Promise<string> => {
  try {
    return await window.uploadFile(file);
  } catch (err) {
    if (window.location !== window.parent.location) {
      window.parent.postMessage({ action: 'bridgeDebug', value: `File upload is not available in preview mode.` }, '*');
    } else {
      alert('[Debug] File upload is not available in preview mode.');
    }
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

export const approve = (value: any) => {
  try {
    window.onPost({ status: 'approve', value });
  } catch (err) {
    if (window.location !== window.parent.location) {
      window.parent.postMessage({ action: 'bridgeDebug', value: `Approved` }, '*');
    } else {
      alert('[Debug] Approved');
    }
  }
}

export const reject = () => {
  try {
    window.onPost({ status: 'reject' });
  } catch (err) {
    if (window.location !== window.parent.location) {
      window.parent.postMessage({ action: 'bridgeDebug', value: `Rejected` }, '*');
    } else {
      alert('[Debug] Rejected');
    }
  }
}

export const next = (menuOptionId?: string) => {
  try {
    window.onPost({ action: 'transition', menuOptionId });
  } catch (err) {
    if (window.location !== window.parent.location) {
      window.parent.postMessage({ action: 'bridgeDebug', value: `Next` }, '*');
    } else {
      alert('[Debug] Next');
    }
  }
}
