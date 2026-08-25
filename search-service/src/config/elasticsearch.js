const { Client } = require("@elastic/elasticsearch");
const env = require("./env");

class ElasticsearchClient {
  constructor() {
    if (ElasticsearchClient.instance) {
      return ElasticsearchClient.instance;
    }
    this.client = new Client({ node: env.elasticsearch.node });
    ElasticsearchClient.instance = this;
  }

  get inner() {
    return this.client;
  }

  async ping() {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new ElasticsearchClient();
