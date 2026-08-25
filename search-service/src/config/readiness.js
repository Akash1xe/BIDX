class Readiness {
  constructor() {
    this.elasticsearchReady = false;
    this.indexReady = false;
    this.consumerRunning = false;
  }
}

module.exports = new Readiness();
