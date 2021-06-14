import { inspect } from '../../lib';
import { chdirWorkspaces } from '../test-utils';
import { DepGraphBuilder } from '@snyk/dep-graph';
import { FILENAMES } from '../../lib/types';

// TODO: jestify tap tests in ./inspect.test.js here
describe('inspect', () => {
  it('should return expected dependencies for poetry-app', async () => {
    const workspace = 'poetry-app';
    chdirWorkspaces(workspace);

    const result = await inspect('.', FILENAMES.poetry.lockfile);
    expect(result).toMatchObject({
      plugin: {
        name: 'snyk-python-plugin',
        runtime: expect.any(String), // any version of Python
        targetFile: FILENAMES.poetry.lockfile,
      },
      package: null, // no dep-tree
      dependencyGraph: {}, // match any dep-graph (equality checked below)
    });

    const builder = new DepGraphBuilder(
      { name: 'poetry' },
      { name: 'poetry-fixtures-project', version: '0.1.0' }
    );
    const expected = builder
      .addPkgNode({ name: 'jinja2', version: '2.11.2' }, 'jinja2')
      .connectDep(builder.rootNodeId, 'jinja2')
      .addPkgNode({ name: 'markupsafe', version: '1.1.1' }, 'markupsafe')
      .connectDep('jinja2', 'markupsafe')
      .build();

    expect(result.dependencyGraph).toEqualDepGraph(expected);
  });
});
