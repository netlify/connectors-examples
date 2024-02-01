import { makeExecutableSchema } from "@graphql-tools/schema";
import { stitchSchemas } from "@graphql-tools/stitch";
import { buildHTTPExecutor } from "@graphql-tools/executor-http";
import { schemaFromExecutor, RenameTypes } from "@graphql-tools/wrap";
import { NetlifyIntegration } from "@netlify/sdk";

const integration = new NetlifyIntegration();

const connector = integration.addConnector({
  typePrefix: `Example`,
});

class BreweryApiClient {
  API: string;
  constructor() {
    this.API = `https://api.openbrewerydb.org/v1`;
  }
  async getBreweries({ by_city, by_ids, by_name, by_postal, by_type }) {
    let apiUrl = this.API + `/breweries`;

    const urlSearchParams = new URLSearchParams();

    if (by_type) {
      urlSearchParams.set(`by_type`, by_type);
    }

    if (by_ids?.length) {
      urlSearchParams.set(`by_ids`, by_ids.join(`,`));
    }

    if (by_name) {
      urlSearchParams.set(`by_name`, by_name);
    }

    if (by_postal) {
      urlSearchParams.set(`by_postal`, by_postal);
    }

    if (by_city) {
      urlSearchParams.set(`by_city`, by_city);
    }

    const res = await fetch(apiUrl + `?${urlSearchParams.toString()}`);
    const data = await res.json();

    return data;
  }

  async breweryById(id) {
    const api = `${this.API}/breweries/${id}`;
    const res = await fetch(api);
    const data = await res.json();
    return data;
  }

  async randomBrewery(size) {
    const api = `${this.API}/breweries/random?size=${size || 1}`;
    const res = await fetch(api);
    const data = await res.json();
    return data;
  }
}

// Connecting an existing GraphQL API
async function getRemoteGraphQLSchema({ typePrefix, uri }) {
  const remoteExecutor = buildHTTPExecutor({
    endpoint: uri,
  });

  const schema = {
    schema: await schemaFromExecutor(remoteExecutor),
    executor: remoteExecutor,
    transforms: [new RenameTypes((name) => `${typePrefix}${name}`)],
  };

  return schema;
}

// Leverage an existing REST API
async function getSchemaFromCustomRestAPI({
  typePrefix,
  apiClient,
}: {
  typePrefix: string;
  apiClient: BreweryApiClient;
}) {
  const typeDefs = `
    enum BreweryType {
      micro
      large
      brewpub
      closed
      proprietor
      contract
    }

    type Brewery {
      id: ID
      name: String
      brewery_type: BreweryType
      address_1: String
      address_2: String
      address_3: String
      city: String
      state_province: String
      postal_code: String
      country: String
      longitude: String
      latitude: String
      phone: String
      website_url: String
      state: String
      street: String
    }

    type Query {
      breweryFromOrigin(id: ID): Brewery
      randomBreweryFromOrigin(size: Int): [Brewery]
      breweriesFromOrigin(by_type: BreweryType, by_ids: [String], by_name: String, by_postal: String, by_city: String): [Brewery]
    }
  `;

  const resolvers = {
    Query: {
      breweryFromOrigin: async (_, { id }) => {
        return apiClient.breweryById(id);
      },
      randomBreweryFromOrigin: async (_, { size }) => {
        return apiClient.randomBrewery(size);
      },
      breweriesFromOrigin: async (
        _,
        { by_type, by_ids, by_name, by_postal, by_city }
      ) => {
        return apiClient.getBreweries({
          by_type,
          by_ids,
          by_name,
          by_postal,
          by_city,
        });
      },
    },
  };

  return {
    transforms: [new RenameTypes((name) => `${typePrefix}Dynamic${name}`)],
    schema: makeExecutableSchema({
      typeDefs,
      resolvers,
    }),
  };
}

connector.init(() => {
  return {
    client: new BreweryApiClient(),
  };
});

connector.model(async ({ define }) => {
  define.document({
    name: `Brewery`,
    fields: {
      contentId: { type: `string`, group: `netlify-connect` },
      name: { type: `string`, group: `netlify-connect` },
      address_1: { type: `string`, group: `netlify-connect` },
      address_2: { type: `string`, group: `netlify-connect` },
      address_3: { type: `string`, group: `netlify-connect` },
      city: { type: `string`, group: `netlify-connect` },
      state: { type: `string`, group: `netlify-connect` },
      street: { type: `string`, group: `netlify-connect` },
      website_url: { type: `string`, group: `netlify-connect` },
      phone: { type: `string`, group: `netlify-connect` },
      longitude: { type: `string`, group: `netlify-connect` },
      latitude: { type: `string`, group: `netlify-connect` },
      country: { type: `string`, group: `netlify-connect` },
      postal_code: { type: `string`, group: `netlify-connect` },
      state_province: { type: `string`, group: `netlify-connect` },
    },
  });
});

connector.sync(async ({ models, state }) => {
  const data = await state.client.getBreweries({});

  data.forEach((brewery) => {
    models["Brewery"].create({
      ...brewery,
      contentId: brewery.id,
    });
  });
});

connector.proxySchema(async ({ typePrefix, state }) => {
  const swapiSchema = await getRemoteGraphQLSchema({
    typePrefix,
    uri: `https://swapi-graphql.netlify.app/.netlify/functions/index`,
  });

  const brewerySchema = await getSchemaFromCustomRestAPI({
    typePrefix,
    apiClient: state.client,
  });

  return stitchSchemas({
    subschemas: [swapiSchema, brewerySchema],
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
