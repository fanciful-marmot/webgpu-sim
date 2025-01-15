export const PRESETS = {
  Default: {
    agentFolder: {
      disabled: false,
      hidden: false,
      children: [
        {
          disabled: false,
          hidden: false,
          label: 'Speed',
          max: 200,
          min: 0,
          binding: {
            key: 'agentSpeed',
            value: 100
          }
        },
        {
          disabled: false,
          hidden: false,
          label: 'Turn speed',
          max: 30,
          min: 1,
          binding: {
            key: 'turnSpeed',
            value: 13
          }
        }
      ],
      expanded: true,
      title: 'Agents'
    },
    globalFolder: {
      disabled: false,
      hidden: false,
      children: [
        {
          disabled: false,
          hidden: false,
          label: 'Decay rate',
          max: 1,
          min: 0,
          binding: {
            key: 'decayRate',
            value: 0.25
          }
        }
      ],
      expanded: true,
      title: 'Global'
    },
    initFolder: {
      disabled: false,
      hidden: false,
      children: [
        {
          disabled: false,
          hidden: false,
          label: 'Num agents',
          max: 2000000,
          min: 1000,
          binding: {
            key: 'numAgents',
            value: 10000
          }
        },
        {
          disabled: false,
          hidden: false,
          label: 'Field size',
          max: 2048,
          min: 128,
          binding: {
            key: 'fieldSize',
            value: 1170
          }
        },
        {
          disabled: false,
          hidden: false,
          title: 'Restart'
        }
      ],
      expanded: true,
      title: 'Initial conditions'
    },
  },
  Nova: {
    agentFolder: {
      disabled: false,
      hidden: false,
      children: [
        {
          disabled: false,
          hidden: false,
          label: 'Speed',
          max: 200,
          min: 0,
          binding: {
            key: 'agentSpeed',
            value: 54
          }
        },
        {
          disabled: false,
          hidden: false,
          label: 'Turn speed',
          max: 30,
          min: 1,
          binding: {
            key: 'turnSpeed',
            value: 2.6
          }
        }
      ],
      expanded: true,
      title: 'Agents'
    },
    globalFolder: {
      disabled: false,
      hidden: false,
      children: [
        {
          disabled: false,
          hidden: false,
          label: 'Decay rate',
          max: 1,
          min: 0,
          binding: {
            key: 'decayRate',
            value: 0.25
          }
        }
      ],
      expanded: true,
      title: 'Global'
    },
    initFolder: {
      disabled: false,
      hidden: false,
      children: [
        {
          disabled: false,
          hidden: false,
          label: 'Num agents',
          max: 2000000,
          min: 1000,
          binding: {
            key: 'numAgents',
            value: 250_000
          }
        },
        {
          disabled: false,
          hidden: false,
          label: 'Field size',
          max: 2048,
          min: 128,
          binding: {
            key: 'fieldSize',
            value: 2048
          }
        },
      ],
      expanded: true,
      title: 'Initial conditions'
    },
  },
  Ring: {
    agentFolder: {
      disabled: false,
      hidden: false,
      children: [
        {
          disabled: false,
          hidden: false,
          label: 'Speed',
          max: 200,
          min: 0,
          binding: {
            key: 'agentSpeed',
            value: 17
          }
        },
        {
          disabled: false,
          hidden: false,
          label: 'Turn speed',
          max: 30,
          min: 1,
          binding: {
            key: 'turnSpeed',
            value: 7.0
          }
        }
      ],
      expanded: true,
      title: 'Agents'
    },
    globalFolder: {
      disabled: false,
      hidden: false,
      children: [
        {
          disabled: false,
          hidden: false,
          label: 'Decay rate',
          max: 1,
          min: 0,
          binding: {
            key: 'decayRate',
            value: 0.815
          }
        }
      ],
      expanded: true,
      title: 'Global'
    },
    initFolder: {
      disabled: false,
      hidden: false,
      children: [
        {
          disabled: false,
          hidden: false,
          label: 'Num agents',
          max: 2000000,
          min: 1000,
          binding: {
            key: 'numAgents',
            value: 10_000
          }
        },
        {
          disabled: false,
          hidden: false,
          label: 'Field size',
          max: 2048,
          min: 128,
          binding: {
            key: 'fieldSize',
            value: 200
          }
        },
      ],
      expanded: true,
      title: 'Initial conditions'
    },
  },
};
