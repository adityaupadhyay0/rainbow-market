import { name as typesName } from '@itfs/types';

export const name = 'cli';

export function run() {
  console.log('ITFS CLI - Inference-Time First Stack v1.0');
  console.log('Types package dependency check:', typesName);
}

run();
