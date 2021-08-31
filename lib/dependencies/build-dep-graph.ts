import { DepGraph } from '@snyk/dep-graph';
import { depTreeToGraph, DepTree } from '@snyk/dep-graph/dist/legacy';

type PackageName = string;

// This is a partially dep tree: every package exists once, all additional reference will have "true" as the value
export interface PartialDepTree {
  name?: string;
  version?: string;
  dependencies?: Dependencies;
  labels?: {
    [key: string]: string;
  };
}

type Dependencies = {
  [depName: string]: PartialDepTree | 'true';
};

export function buildDepGraph(
  partialDepTree: PartialDepTree,
  projectName?: string
): Promise<DepGraph> {
  const packageToDepTreeMap = new Map<PackageName, PartialDepTree>();

  const queue: Dependencies[] = [partialDepTree.dependencies];
  const referencesToUpdate: { key: string; dependencies: Dependencies }[] = [];
  while (queue.length > 0) {
    const dependencies = queue.pop();
    if (!dependencies) continue;

    for (const [key, dependencyDepTree] of Object.entries(dependencies)) {
      if (dependencyDepTree === 'true') {
        referencesToUpdate.push({ key, dependencies });
      } else {
        packageToDepTreeMap.set(key, dependencyDepTree);
        queue.push(dependencyDepTree.dependencies);
      }
    }
  }

  referencesToUpdate.forEach(({ key, dependencies }) => {
    if (!packageToDepTreeMap.get(key)) {
      // this should never happen
      throw new Error(`key ${key} not found in packageToDepTreeMap`);
    }
    dependencies[key] = packageToDepTreeMap.get(key);
  });

  if (projectName) partialDepTree.name = projectName;

  return depTreeToGraph(partialDepTree as DepTree, 'pip');
}
