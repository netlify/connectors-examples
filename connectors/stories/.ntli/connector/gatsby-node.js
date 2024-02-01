
import { integration } from "./index.js";
const { contentEngineImplementations } = integration.netlifyConnectPlugin;

export const onPluginInit = contentEngineImplementations.onPluginInit;
export const sourceNodes = contentEngineImplementations.sourceNodes;
export const createSchemaCustomization = contentEngineImplementations.createSchemaCustomization;
