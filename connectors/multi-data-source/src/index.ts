import { NetlifyIntegration } from "@netlify/sdk";

const integration = new NetlifyIntegration();

const connector = integration.addConnector({
  typePrefix: `Example`,
});

class SportsClient {
  API: string;
  constructor() {
    this.API = `https://www.balldontlie.io/api/v1/`;
  }
  async getTeams() {
    const api = `${this.API}/teams`;
    const res = await fetch(api);
    const data = await res.json();
    return data?.data;
  }

  async getMlb() {
    const api = `https://statsapi.mlb.com/api/v1/teams`;
    const res = await fetch(api);
    const data = await res.json();
    return data?.teams;
  }
}

connector.init(() => {
  return {
    client: new SportsClient(),
  };
});

connector.model(async ({ define }) => {
  define.document({
    name: `Team`,
    fields: {
      abbreviation: { type: `string`, group: `netlify-connect` },
      contentId: { type: `string`, group: `netlify-connect` },
      name: { type: `string`, group: `netlify-connect` },
      full_name: { type: `string`, group: `netlify-connect` },
      city: { type: `string`, group: `netlify-connect` },
      division: { type: `string`, group: `netlify-connect` },
      conference: { type: `string`, group: `netlify-connect` },
      sport: { type: `string`, group: `netlify-connect` },
      sportType: { type: `string`, group: `netlify-connect` },
    },
  });
});

connector.sync(async ({ models, state }) => {
  const data = await state.client.getTeams();
  const mlb = await state.client.getMlb();

  mlb.forEach((team) => {
    models["Team"].create({
      id: team.id,
      full_name: team?.teamName,
      name: team?.shortName,
      abbreviation: team.abbreviation,
      contentId: team.id,
      sport: team?.sport?.name,
      division: team?.division?.name,
      city: team?.locationName,
      sportType: `BASEBALL`,
    });
  });

  data.forEach((team) => {
    models["Team"].create({
      ...team,
      sport: `National Basketball Association`,
      sportType: `BASKETBALL`,
      contentId: team.id,
    });
  });
});

integration.onEnable(async (_, { teamId, client }) => {
  // Connectors are disabled by default, so we need to
  // enable them when the integration is enabled.

  teamId && (await client.enableConnectors(teamId));

  return {
    statusCode: 200,
  };
});

// the integration must be exported as a named export for the Netlify SDK to use it.
export { integration };
