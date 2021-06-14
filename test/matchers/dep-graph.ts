import * as depGraphLib from '@snyk/dep-graph';
import diff from 'jest-diff';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toEqualDepGraph(expected: depGraphLib.DepGraph): R;
    }
    interface Expect {
      toEqualDepGraph(expected: depGraphLib.DepGraph): void;
    }
  }
}

export function toEqualDepGraph(
  received: depGraphLib.DepGraph,
  expected: depGraphLib.DepGraph
): jest.CustomMatcherResult {
  // Diff dep-graph data. This will display ordering differences
  // but it should be enough to get a rough idea of the failure
  const getDiff = () =>
    diff(expected.toJSON(), received.toJSON(), { expand: false });

  if (received.equals(expected)) {
    return {
      message: () => `expected depGraphs not to be equal\n\n${getDiff()}`,
      pass: true,
    };
  } else {
    return {
      message: () => `expected depGraphs to be equal\n\n${getDiff()}`,
      pass: false,
    };
  }
}
