// src/index.ts
import { NetlifyIntegration } from "@netlify/sdk";
import csv from "csvtojson";
import { google } from "googleapis";
var integration = new NetlifyIntegration();
var connector = integration.addConnector({
  typePrefix: "Holiday",
  localDevOptions: {
    apiKey: process.env.GOOGLE_DRIVE_API_KEY,
    fileId: process.env.GOOGLE_DRIVE_FILE_ID
  }
});
connector.defineOptions(({ zod }) => {
  return zod.object({
    apiKey: zod.string().meta({
      label: "Google Drive API Key",
      helpText: "The API Key used for Google Drive",
      secret: true
      // set this to true for API tokens and other secret values
    }),
    fileId: zod.string().meta({
      label: "Google Drive File ID",
      helpText: "The File ID for Google Drive"
    })
  });
});
connector.init(async ({ options }) => {
  const drive = google.drive({
    version: "v3",
    auth: options.apiKey
  });
  return {
    drive
  };
});
connector.model(async ({ define }) => {
  define.nodeModel({
    name: "Story",
    fields: {
      title: {
        type: "String",
        required: true
      },
      body: {
        type: "String",
        required: true
      },
      image: {
        type: "String",
        required: true
      }
    }
  });
});
connector.sync(async ({ models, state, options }) => {
  try {
    const file = await state.drive.files.get({
      fileId: options.fileId,
      alt: "media"
    });
    const stories = await csv().fromString(file.data);
    stories.forEach(({ title, body }, index) => {
      models.Story.create({
        id: `${title}_${body}`,
        title,
        body,
        image: `https://storage.googleapis.com/jamhack-2023-vector-search-assets/image${index}.png`
      });
    });
  } catch (err) {
    console.error(err);
  }
});
integration.onEnable(async (_, { teamId, client }) => {
  teamId && await client.enableConnectors(teamId);
  return {
    statusCode: 200
  };
});
export {
  integration
};
//# sourceMappingURL=index.js.map
