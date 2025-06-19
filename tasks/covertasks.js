var gulp = require('gulp');
var del = require('del');
var jeditor = require("gulp-json-editor");
var istanbulReport = require('gulp-istanbul-report');
var cproc = require('child_process');

gulp.task('default', function(done) {
    // You can specify tasks to run here, for example:
    // gulp.series('cover:clean', 'cover:enable', 'cover:disable')(done);
    done();
});

gulp.task('cover:clean', function (done) {
    return del('coverage', done);
});

gulp.task('cover:enableconfig',() => {
    return gulp.src("./coverconfig.json")
    .pipe(jeditor(function(json) {
        json.enabled = true;
        return json; // must return JSON object.
    }))
    .pipe(gulp.dest("./out", {'overwrite':true}));
});

gulp.task('cover:enable', gulp.series('cover:clean', 'html:test', 'cover:enableconfig'));

gulp.task('cover:disable', () => {
    return gulp.src("./coverconfig.json")
    .pipe(jeditor(function(json) {
        json.enabled = false;
        return json; // must return JSON object.
    }))
    .pipe(gulp.dest("./out", {'overwrite':true}));
});

gulp.task('cover:combine', () => {
    return gulp.src(['./coverage/coverage-final.json', './coverage/coverage-html.json'])
    .pipe(istanbulReport({
        reporterOpts: {
            dir: './coverage'
        },
        reporters: [
            {'name': 'lcovonly'}, // -> ./coverage/report.txt
            {'name': 'cobertura'} // -> ./jsonCov/cov.json
        ]
    }));
});

// for running on the jenkins build system
gulp.task('cover:jenkins', gulp.series('cover:clean', 'cover:enableconfig', 'html:test', 'ext:test', 'cover:combine'));