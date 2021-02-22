import reporter from "gatsby-cli/lib/reporter"
import apiRunnerNode from "../utils/api-runner-node"
import { IDataLayerContext } from "../state-machines/data-layer/types"
import { assertStore } from "../utils/assert-store"
import { IGatsbyPage } from "../redux/types"
import { actions } from "../redux/actions"
import { deleteUntouchedPages, findChangedPages } from "../utils/changed-pages"

export async function createPages({
  parentSpan,
  gatsbyNodeGraphQLFunction,
  store,
  deferNodeMutation,
}: Partial<IDataLayerContext>): Promise<{
  deletedPages: Array<string>
  changedPages: Array<string>
}> {
  assertStore(store)
  const activity = reporter.activityTimer(`createPages`, {
    parentSpan,
  })
  activity.start()
  const timestamp = Date.now()
  const currentPages = new Map<string, IGatsbyPage>(store.getState().pages)
  await apiRunnerNode(
    `createPages`,
    {
      graphql: gatsbyNodeGraphQLFunction,
      traceId: `initial-createPages`,
      waitForCascadingActions: true,
      parentSpan: activity.span,
      deferNodeMutation,
    },
    { activity }
  )

  reporter.info(
    `Total nodes: ${store.getState().nodes.size}, SitePage nodes: ${
      store.getState().nodesByType?.get(`SitePage`)?.size
    } (use --verbose for breakdown)`
  )

  if (process.env.gatsby_log_level === `verbose`) {
    reporter.verbose(
      `Number of node types: ${
        store.getState().nodesByType.size
      }. Nodes per type: ${[...store.getState().nodesByType.entries()]
        .map(([type, nodes]) => type + `: ` + nodes.size)
        .join(`, `)}`
    )
  }

  activity.end()

  reporter.verbose(`Checking for deleted pages`)

  const deletedPages = deleteUntouchedPages(store.getState().pages, timestamp)

  reporter.verbose(
    `Deleted ${deletedPages.length} page${deletedPages.length === 1 ? `` : `s`}`
  )

  const tim = reporter.activityTimer(`Checking for changed pages`)
  tim.start()

  const { changedPages } = findChangedPages(
    currentPages,
    store.getState().pages
  )

  reporter.verbose(
    `Found ${changedPages.length} changed page${
      changedPages.length === 1 ? `` : `s`
    }`
  )
  tim.end()

  store.dispatch(actions.apiFinished({ apiName: `createPages` }))

  return {
    changedPages,
    deletedPages,
  }
}
