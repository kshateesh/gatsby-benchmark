import _ from "lodash"

import sampleSiteForExperiment from "../sample-site-for-experiment"
import handleFlags from "../handle-flags"
import { IFlag, satisfiesSemvers, fitnessEnum } from "../flags"

jest.mock(`gatsby-core-utils`, () => {
  return {
    isCI: (): boolean => true,
  }
})

describe(`satisfies semver`, () => {
  it(`returns false if a module doesn't exist`, () => {
    const semverConstraints = {
      // Because of this, this flag will never show up
      "gatsby-plugin-sharpy": `>=2.10.0`,
    }
    expect(satisfiesSemvers(semverConstraints)).toBeFalsy()
  })
})

describe(`handle flags`, () => {
  const activeFlags: Array<IFlag> = [
    {
      name: `FAST_DEV`,
      env: `GATSBY_EXPERIMENTAL_FAST_DEV`,
      command: `develop`,
      telemetryId: `test`,
      experimental: false,
      description: `Enable all experiments aimed at improving develop server start time`,
      includedFlags: [`DEV_SSR`, `QUERY_ON_DEMAND`],
      testFitness: (): fitnessEnum => true,
    },
    {
      name: `DEV_SSR`,
      env: `GATSBY_EXPERIMENTAL_DEV_SSR`,
      command: `develop`,
      telemetryId: `test`,
      experimental: false,
      description: `SSR pages on full reloads during develop. Helps you detect SSR bugs and fix them without needing to do full builds.`,
      umbrellaIssue: `https://github.com/gatsbyjs/gatsby/discussions/28138`,
      testFitness: (): fitnessEnum => true,
    },
    {
      name: `QUERY_ON_DEMAND`,
      env: `GATSBY_EXPERIMENTAL_QUERY_ON_DEMAND`,
      command: `develop`,
      telemetryId: `test`,
      experimental: false,
      description: `Only run queries when needed instead of running all queries upfront. Speeds starting the develop server.`,
      umbrellaIssue: `https://github.com/gatsbyjs/gatsby/discussions/27620`,
      noCI: true,
      testFitness: (): fitnessEnum => true,
    },
    {
      name: `ONLY_BUILDS`,
      env: `GATSBY_EXPERIMENTAL_BUILD_ME_FASTER`,
      command: `build`,
      telemetryId: `test`,
      experimental: false,
      description: `test`,
      umbrellaIssue: `test`,
      testFitness: (): fitnessEnum => true,
    },
    {
      name: `ALL_COMMANDS`,
      env: `GATSBY_EXPERIMENTAL_SOMETHING_COOL`,
      command: `all`,
      telemetryId: `test`,
      experimental: false,
      description: `test`,
      umbrellaIssue: `test`,
      testFitness: (): fitnessEnum => true,
    },
    {
      name: `YET_ANOTHER`,
      env: `GATSBY_EXPERIMENTAL_SOMETHING_COOL2`,
      command: `all`,
      telemetryId: `test`,
      experimental: false,
      description: `test`,
      umbrellaIssue: `test`,
      testFitness: (): fitnessEnum => true,
    },
    {
      name: `PARTIAL_RELEASE`,
      env: `GATSBY_READY_TO_GO`,
      command: `all`,
      telemetryId: `test`,
      experimental: false,
      description: `test`,
      umbrellaIssue: `test`,
      testFitness: (flag): fitnessEnum => {
        if (sampleSiteForExperiment(flag.name, 100)) {
          return `OPT_IN`
        } else {
          return false
        }
      },
    },
    {
      name: `PARTIAL_RELEASE_ONLY_VERY_OLD_LODASH`,
      env: `GATSBY_READY_TO_GO_LODASH`,
      command: `all`,
      telemetryId: `test`,
      experimental: false,
      description: `test`,
      umbrellaIssue: `test`,
      testFitness: (flag): fitnessEnum => {
        const semver = {
          // Because of this, this flag will never show up
          lodash: `<=3.9`,
        }
        if (
          satisfiesSemvers(semver) &&
          sampleSiteForExperiment(flag.name, 100)
        ) {
          return `OPT_IN`
        } else {
          return false
        }
      },
    },
    {
      name: `PARTIAL_RELEASE_ONLY_NEW_LODASH`,
      env: `GATSBY_READY_TO_GO_NEW_LODASH`,
      command: `all`,
      description: `test`,
      umbrellaIssue: `test`,
      telemetryId: `test`,
      experimental: false,
      testFitness: (flag): fitnessEnum => {
        const semver = {
          // Because of this, this flag will never show up
          lodash: `>=4.9`,
        }
        if (
          satisfiesSemvers(semver) &&
          sampleSiteForExperiment(flag.name, 100)
        ) {
          return `OPT_IN`
        } else {
          return false
        }
      },
    },
  ]

  const configFlags = {
    FAST_DEV: true,
    ALL_COMMANDS: true,
  }
  const configFlagsWithFalse = {
    ALL_COMMANDS: true,
    DEV_SSR: false,
  }
  const configWithFlagsNoCi = {
    QUERY_ON_DEMAND: true,
    DEV_SSR: true,
  }

  it(`returns enabledConfigFlags and a message`, () => {
    expect(handleFlags(activeFlags, configFlags, `develop`)).toMatchSnapshot()
  })

  it(`filters out flags marked false`, () => {
    const result = handleFlags(activeFlags, configFlagsWithFalse, `develop`)
    expect(result.enabledConfigFlags).toHaveLength(3)
    expect(result).toMatchSnapshot()
  })

  it(`filters out flags that are marked as not available on CI`, () => {
    expect(
      handleFlags(activeFlags, configWithFlagsNoCi, `develop`)
        .enabledConfigFlags
    ).toHaveLength(3)
  })

  it(`filters out flags that aren't for the current command`, () => {
    expect(
      handleFlags(activeFlags, configFlags, `build`).enabledConfigFlags
    ).toHaveLength(3)
  })

  it(`returns a message about unknown flags in the config`, () => {
    const unknownConfigFlags = handleFlags(
      activeFlags,
      { ALL_COMMANDS: true, FASTLY_DEV: true, SUPER_COOL_FLAG: true },
      `develop`
    )
    expect(unknownConfigFlags).toMatchSnapshot()
  })

  it(`opts in sites to a flag if their site is selected for partial release`, () => {
    // Nothing is enabled in their config.
    const response = handleFlags(activeFlags, {}, `develop`)
    expect(response).toMatchSnapshot()
  })

  it(`removes flags people explicitly opt out of and ignores flags that don't pass semver`, () => {
    const response = handleFlags(
      activeFlags,
      {
        PARTIAL_RELEASE: false,
        PARTIAL_RELEASE_ONLY_NEW_LODASH: false,
      },
      `develop`
    )
    expect(response.enabledConfigFlags).toHaveLength(0)
  })

  it(`doesn't count unfit flags as unknown`, () => {
    const response = handleFlags(
      activeFlags,
      {
        PARTIAL_RELEASE_ONLY_VERY_OLD_LODASH: true,
        PARTIAL_RELEASE: false,
        PARTIAL_RELEASE_ONLY_NEW_LODASH: false,
      },
      `develop`
    )

    // it currently just silently disables it
    expect(response).toMatchInlineSnapshot(`
      Object {
        "enabledConfigFlags": Array [],
        "message": "",
        "unknownFlagMessage": "",
      }
    `)
  })

  it(`Prefers explicit opt-in over auto opt-in (for terminal message)`, () => {
    const response = handleFlags(
      activeFlags.concat([
        {
          name: `ALWAYS_OPT_IN`,
          env: `GATSBY_ALWAYS_OPT_IN`,
          command: `all`,
          description: `test`,
          umbrellaIssue: `test`,
          telemetryId: `test`,
          experimental: false,
          // this will always OPT IN
          testFitness: (): fitnessEnum => `OPT_IN`,
        },
      ]),
      {
        ALWAYS_OPT_IN: true,
        DEV_SSR: true,
        PARTIAL_RELEASE: false,
        PARTIAL_RELEASE_ONLY_NEW_LODASH: false,
      },
      `develop`
    )

    expect(response.message).not.toContain(`automatically enabled`)
    expect(response.message).toMatchInlineSnapshot(`
      "The following flags are active:
      - ALWAYS_OPT_IN · (Umbrella Issue (test)) · test
      - DEV_SSR · (Umbrella Issue (https://github.com/gatsbyjs/gatsby/discussions/28138)) · SSR pages on full reloads during develop. Helps you detect SSR bugs and fix them without needing to do full builds.

      There are 7 other flags available that you might be interested in:
      - FAST_DEV · Enable all experiments aimed at improving develop server start time
      - QUERY_ON_DEMAND · (Umbrella Issue (https://github.com/gatsbyjs/gatsby/discussions/27620)) · Only run queries when needed instead of running all queries upfront. Speeds starting the develop server.
      - ONLY_BUILDS · (Umbrella Issue (test)) · test
      - ALL_COMMANDS · (Umbrella Issue (test)) · test
      - YET_ANOTHER · (Umbrella Issue (test)) · test
      - PARTIAL_RELEASE · (Umbrella Issue (test)) · test
      - PARTIAL_RELEASE_ONLY_NEW_LODASH · (Umbrella Issue (test)) · test
      "
    `)
  })

  describe(`LOCKED_IN`, () => {
    it(`Enables locked in flag by default and doesn't mention it in terminal (no spam)`, () => {
      const response = handleFlags(
        [
          {
            name: `ALWAYS_LOCKED_IN`,
            env: `GATSBY_ALWAYS_LOCKED_IN`,
            command: `all`,
            description: `test`,
            umbrellaIssue: `test`,
            telemetryId: `test`,
            experimental: false,
            // this will always LOCKED IN
            testFitness: (): fitnessEnum => `LOCKED_IN`,
          },
        ],
        {},
        `develop`
      )

      expect(response.enabledConfigFlags).toContainEqual(
        expect.objectContaining({ name: `ALWAYS_LOCKED_IN` })
      )
      expect(response.message).toEqual(``)
    })

    it(`Display message saying config flag for LOCKED_IN feature is no-op`, () => {
      const response = handleFlags(
        [
          {
            name: `ALWAYS_LOCKED_IN_SET_IN_CONFIG`,
            env: `GATSBY_ALWAYS_LOCKED_IN_SET_IN_CONFIG`,
            command: `all`,
            description: `test`,
            umbrellaIssue: `test`,
            telemetryId: `test`,
            experimental: false,
            // this will always LOCKED IN
            testFitness: (): fitnessEnum => `LOCKED_IN`,
          },
        ],
        {
          // this has no effect, but we want to show to user that
          ALWAYS_LOCKED_IN_SET_IN_CONFIG: true,
        },
        `develop`
      )

      expect(response.enabledConfigFlags).toContainEqual(
        expect.objectContaining({ name: `ALWAYS_LOCKED_IN_SET_IN_CONFIG` })
      )
      expect(response.message).toMatchInlineSnapshot(`
        "Some features you configured with flags are used natively now.
        Those flags no longer have any effect and you can remove them from config:
        - ALWAYS_LOCKED_IN_SET_IN_CONFIG · (Umbrella Issue (test)) · test
        "
      `)
    })

    it(`Kitchen sink`, () => {
      const response = handleFlags(
        activeFlags.concat([
          {
            name: `ALWAYS_LOCKED_IN`,
            env: `GATSBY_ALWAYS_LOCKED_IN`,
            command: `all`,
            description: `test`,
            umbrellaIssue: `test`,
            telemetryId: `test`,
            experimental: false,
            // this will always LOCKED IN
            testFitness: (): fitnessEnum => `LOCKED_IN`,
          },
          {
            name: `ALWAYS_LOCKED_IN_SET_IN_CONFIG`,
            env: `GATSBY_ALWAYS_LOCKED_IN_SET_IN_CONFIG`,
            command: `all`,
            description: `test`,
            umbrellaIssue: `test`,
            telemetryId: `test`,
            experimental: false,
            // this will always LOCKED IN
            testFitness: (): fitnessEnum => `LOCKED_IN`,
          },
        ]),
        {
          ALWAYS_OPT_IN: true,
          DEV_SSR: true,
          PARTIAL_RELEASE: false,
          PARTIAL_RELEASE_ONLY_NEW_LODASH: false,
          // this has no effect, but we want to show to user that
          ALWAYS_LOCKED_IN_SET_IN_CONFIG: true,
        },
        `develop`
      )

      // this is enabled, but because it's not configurable anymore and user doesn't set it explicitly in config - there is no point in printing information about it
      expect(response.enabledConfigFlags).toContainEqual(
        expect.objectContaining({ name: `ALWAYS_LOCKED_IN` })
      )
      // this is enabled, but because it's not configurable anymore and user sets it in config - we want to mention that this config flag has no effect anymore
      expect(response.enabledConfigFlags).toContainEqual(
        expect.objectContaining({ name: `ALWAYS_LOCKED_IN_SET_IN_CONFIG` })
      )
      expect(response.message).toMatchInlineSnapshot(`
        "The following flags are active:
        - DEV_SSR · (Umbrella Issue (https://github.com/gatsbyjs/gatsby/discussions/28138)) · SSR pages on full reloads during develop. Helps you detect SSR bugs and fix them without needing to do full builds.

        Some features you configured with flags are used natively now.
        Those flags no longer have any effect and you can remove them from config:
        - ALWAYS_LOCKED_IN_SET_IN_CONFIG · (Umbrella Issue (test)) · test

        There are 5 other flags available that you might be interested in:
        - FAST_DEV · Enable all experiments aimed at improving develop server start time
        - QUERY_ON_DEMAND · (Umbrella Issue (https://github.com/gatsbyjs/gatsby/discussions/27620)) · Only run queries when needed instead of running all queries upfront. Speeds starting the develop server.
        - ONLY_BUILDS · (Umbrella Issue (test)) · test
        - ALL_COMMANDS · (Umbrella Issue (test)) · test
        - YET_ANOTHER · (Umbrella Issue (test)) · test
        - PARTIAL_RELEASE · (Umbrella Issue (test)) · test
        - PARTIAL_RELEASE_ONLY_NEW_LODASH · (Umbrella Issue (test)) · test
        "
      `)
    })
  })
})
