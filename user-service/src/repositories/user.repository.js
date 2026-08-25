const User = require("../models/user.model");

class UserRepository {
  async create(data) {
    return User.create(data);
  }

  findById(id) {
    return User.findById(id);
  }

  findByEmail(email, includePassword = false) {
    const query = User.findOne({ email });
    if (includePassword) {
      query.select("+password");
    }
    return query;
  }

  findByGoogleId(googleId) {
    return User.findOne({ googleId });
  }

  async updateById(id, updates) {
    return User.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
  }
}

module.exports = new UserRepository();
