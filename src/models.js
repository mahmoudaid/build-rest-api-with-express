'use strict';

var mongoose = require("mongoose");
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt');

/*
* User
*/
var UserSchema = new Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required.'],
    trim: true
  },
  emailAddress: {
    type: String,
    required: [true, 'An email address is required.'],
    unique: true,
    trim: true,

    // Custom validation for email format.
    validate: {
      validator: function(email) {
        return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email);
      },
      message: 'Email address must be in a valid format.'
    }
  },
  password: {
    type: String,
    required: [true, 'Please enter a password.']
  },
  confirmPassword: {
    type: String,
    required: [true, 'Please enter a confirmation password.']
  }
});

// Hash passwords before saving to db.
UserSchema.pre('save', function(next) {
  var user = this;

  // First hash the password field.
  bcrypt.hash(user.password, 10, function(err, hash) {
    if (err) {
      return next(err);
    }
    user.password = hash;

    // Then hash the confirmPassword field.
    bcrypt.hash(user.confirmPassword, 10, function(err, hash) {
      if (err) {
        return next(err);
      }
      user.confirmPassword = hash;

      // Call next() when both passwords are hashed.
      next();
    });
  });
});

// Password must be at least 8 characters.
UserSchema.path('password').validate(function(v, callback) {
  var regEx = new RegExp("^(?=.{8,})");
  return regEx.test(this.password);
}, "The password must contain at least 8 characters.");

// Validate middleware compares the two password fields
UserSchema.pre('validate', function(next) {
  if (this.password !== this.confirmPassword) {
    // Invalidate password field if they don't match.
    this.invalidate('password', 'Passwords must match!');
    next();
    // If match, continue.
  } else {
    next();
  }
});

var User = mongoose.model('User', UserSchema);


/*
* Review
*/
var ReviewSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  postedOn: Date,
  rating: {
    type: Number,
    required: [true, 'A rating is required.'],
    min: [1, 'A minimum rating of "1" is required.'],
    max: [5, '"5" is the maximum rating.']
  },
  review: String
});

// Round entered rating to nearest integer before saving to db.
ReviewSchema.pre('save', function(next) {
  Math.round(this.rating);
  next();
});

var Review = mongoose.model('Review', ReviewSchema);


/*
* Course
*/
var CourseSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  title: {
    type: String,
    required: [true, 'A title is required.']
  },
  description: {
    type: String,
    required: [true, 'A description is required.']
  },
  estimatedTime: String,
  materialsNeeded: String,
  steps: {
    type: [{
      stepNumber: Number,
      title: {
        type: String,
        required: [true, 'Step must have a title.']
      },
      description: {
        type: String,
        required: [true, 'Step must have a description.']
      }
    }],
    required: [true, 'At least one step is required.']
  },
  reviews: [{
    type: Schema.Types.ObjectId,
    ref: 'Review'
  }]
});

// Create virtual overallRating field in courses.
CourseSchema.virtual('overallRating').get(function() {
  var totalRatings = 0;
  var result = 0;
  if (this.reviews) {
    for (var i = 0; i < this.reviews.length; i++) {
      totalRatings += this.reviews[i].rating;
    }
    result = Math.round(totalRatings / this.reviews.length);
  }
  return result;
});

var Course = mongoose.model('Course', CourseSchema);

// Export models
module.exports.User = User;
module.exports.Review = Review;
module.exports.Course = Course;