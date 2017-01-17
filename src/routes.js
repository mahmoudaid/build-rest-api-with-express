'use strict';

var express = require('express');
var router = express.Router();
var Course = require('./models').Course;
var User = require('./models').User;
var Review = require('./models').Review;
var mid = require('./middleware');
var validationErrors = require('./formatValidationErrors').validationErrors;

/*
* Courses
* Get list of courses each course contains id and title.
*/
router.get('/courses', function (req, res, next) {
	Course.find({}, '_id title')
	.exec(function(err, courses){
		if(err) return next(err);
		res.json({
	        data: courses
	    });
	});
});


/*
* Course
* Get Individual course by id.
*/
router.get('/courses/:id', function(req, res, next){
	Course.findById(req.params.id)
	// Populate the reviews and user field.
	.populate('reviews')
	.populate('user')
	.exec(function(error, course) {
		if (error) return next(error);

		// Populate review user
	  	var options = {
	      path: 'reviews.user',
	      model: 'User'
	    };

	    Course.populate(course, options, function (err, course) {
			res.json({
				data: [course.toJSON({ virtuals: true })]
			});
		});
	});
});


/*
* Post new course
* @return Location /courses.
*/
router.post('/courses', mid.checkAuthorization, function(req, res, next) {
	// Create a new course
	var course = new Course(req.body);
	
	// Save the new course
	course.save( function (err) {
		// Check for validation errors
		if (err) return validationErrors(err, req, res, next);
		
		// Set location to courses
		res.status(201);
		res.location('/courses');
		res.end();
	});
});


/*
* Update a course
* @return no content.
*/
router.put('/courses/:id', mid.checkAuthorization, function(req, res, next) {
	// The current user can only edit courses for themselves
	if (req.body.user._id === req.user._id.toJSON()) {
		Course.findOneAndUpdate({
		  	_id: req.params.id
		}, req.body, function(err, results) {
			if (err) {
				// Check for validation errors
				return validationErrors(err, req, res, next);
			} else {
				res.status(204);
				res.end();
			}
		});
	} else {
		var err = new Error("You can only edit a course for yourself.");
		err.status = 401;
		return next(err);
	}
});


/*
* Get Auth
* @return currently authenticated user.
*/
router.get('/users', mid.checkAuthorization, function(req, res, next) {
	res.json({
		data: [req.user]
	});
});

/*
* Post new user
* @return location /.
*/
router.post('/users', function(req, res, next) {
  var user = new User(req.body);
  user.save(function(err) {
  	// Check for validation errors
    if (err) return validationErrors(err, req, res, next);
    res.status(201);
    res.location('/');
    res.end();
  });
});


/*
* Post new review for the specified course
* @return location /courses/courseId.
*/
router.post('/courses/:courseId/reviews', mid.checkAuthorization, function(req, res, next) {

  	// Get the course by ID
  	Course.findById(req.params.courseId)
    .populate('user')
    .populate('reviews')
    .exec(function(err, course) {

		// If db error, throw error.
		if (err) return next(err);

		// Don't allow more than one review per user.
		for (var i = 0; i < course.reviews.length; i++) {
			if (course.reviews[i].user.toJSON() === req.user._id.toJSON()) {
				//console.log(course.reviews[i].user.toJSON());
			  	err = new Error("Sorry, you can only add one review per course.");
			  	err.status = 401;
			  	return next(err);
			}
		}

		// Don't allow the course owner to post a review on their own course.
		if (req.user._id.toJSON() === course.user._id.toJSON()) {
			err = new Error("Sorry, you can't review your own courses.");
			err.status = 401;
			return next(err);
		}

		// Create a new review to be appended to the reviews of this course
		var review = new Review(req.body);

		// Set postedOn to now
		review.postedOn = Date.now();

		// Assign the user id from the authenticated user's id
		if (req.user._id) {
			review.user = req.user._id;
		} else {
			var error = new Error('Sorry, you must be logged in to post a review.');
			error.status = 401;
			return next(error);
		}

		// Add the new review to the current course's reviews array.
		course.reviews.push(review);

		// Save the course we've just added to.
		course.save(function(error) {
			if (error) return next(error);
		});

		// Save the new review we've just created.
		review.save(function(err, results) {
			if (err) {
			  	return validationErrors(err, req, res, next);
			} else {
				res.status(201);
				res.location('/courses/' + req.params.courseId);
				res.end();
			}
		});
    });
});


/*
* Deletes the specified review 
* @return no content.
*/
router.delete('/courses/:courseId/reviews/:id', mid.checkAuthorization, function(req, res, next) {

  	Review.findById(req.params.id)
    .populate('user')
    .exec(function(err, review) {

		// Handle db error.
		if (err) return next(err);

		// Throw error if review not found.
		if (!review) {
			var error = new Error('Review not found!');
			error.status = 404;
			return next(error);
		}

      	// Look up current course to get course owner.
      	Course.findById(req.params.courseId)
        .populate('user')
        .exec(function(err, course) {

        	// Handle db error.
        	if (err) return next(err);

			// Throw error if course not found.
			if (!course) {
				var e = new Error('Course not found!');
				e.status = 404;
				return next(e);
			}

			// Get current user.
			var currentUser = req.user._id.toJSON();

			// Get course owner.
			var courseOwner = course.user._id.toJSON();

			// Get review owner.
			var reviewOwner = review.user._id.toJSON();

			// Only the review's user or course owner can delete a review.
			if (currentUser === courseOwner || currentUser === reviewOwner) {
				// Remove the review.
				Review.findById(req.params.id)
				.remove()
				.exec(function(err) {
				    // Handle db error.
				    if (err) return next(err);
				});

				res.status(204);
				res.end();
			} else {
				var error = new Error('Sorry, only the review owner or course owner can delete a review.');
				error.status = 401;
				return next(error);
			}
        });
    });
});

/*
* Unsupported HTTP 
*/


/*
* PUT /api/users 
* @return 403.
*/
router.put('/users', function(req, res, next) {
	var err = new Error('Cannot edit a collection of users.');
	err.status = 403;
	return next(err);
});

/*
* DELETE /api/users 
* @return 403.
*/
router.delete('/users', function(req, res, next) {
	var err = new Error('Cannot delete a collection of users.');
	err.status = 403;
	return next(err);
});

/*
* PUT /api/courses
* @return 403.
*/
router.put('/courses', function(req, res, next) {
	var err = new Error('Cannot edit a collection of courses.');
	err.status = 403;
	return next(err);
});

/*
* DELETE /api/courses
* @return 403.
*/
router.delete('/courses', function(req, res, next) {
	var err = new Error('Cannot delete a collection of courses.');
	err.status = 403;
	return next(err);
});

/*
* POST /api/courses/:id 
* @return 405.
*/
router.post('/courses/:id', function(req, res, next) {
	var err = new Error("Use the '/api/courses' route to create a course.");
	err.status = 405;
	res.setHeader('Allow', 'GET,PUT');
	return next(err);
});

/*
* DELETE /api/courses/:id
* @return 403.
*/
router.delete('/courses/:id', function(req, res, next) {
	var err = new Error('Cannot delete a course.');
	err.status = 403;
	return next(err);
});

/*
* PUT /api/courses/:courseId/reviews
* @return 403.
*/
router.put('/courses/:courseId/reviews', function(req, res, next) {
	var err = new Error('Cannot edit a collection of reviews.');
	err.status = 403;
	return next(err);
});

/*
* DELETE /api/courses/:courseId/reviews
* @return 403.
*/
router.delete('/courses/:courseId/reviews', function(req, res, next) {
	var err = new Error('Cannot delete a collection of reviews.');
	err.status = 403;
	return next(err);
});

/*
* GET /api/courses/:courseId/reviews/:id
* @return 403.
*/
router.get('/courses/:courseId/reviews/:id', function(req, res, next) {
	var err = new Error("Cannot get a single review. Use the '/api/courses/:id' route instead to get the reviews for a specific course.");
	err.status = 403;
	return next(err);
});

/*
* POST /api/courses/:courseId/reviews/:id
* @return 405.
*/
router.post('/courses/:courseId/reviews/:id', function(req, res, next) {
	var err = new Error("Use the '/api/courses/:courseId/reviews' route to create a review.");
	err.status = 405;
	res.setHeader('Allow', 'DELETE');
	return next(err);
});

/*
* PUT /api/courses/:courseId/reviews/:id
* @return 403.
*/
router.put('/courses/:courseId/reviews/:id', function(req, res, next) {
	var err = new Error('Cannot edit a review.');
	err.status = 403;
	return next(err);
});

module.exports = router;