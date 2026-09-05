import gulp from "gulp";
import autoprefixer from "gulp-autoprefixer";
import gulpSass from "gulp-sass";
import * as dartSass from "sass";

const sass = gulpSass(dartSass);
const SYSTEM_SCSS = ["scss/**/*.scss"];

/**
 * Compile HM3 SCSS with Dart Sass and apply browser prefixes.
 *
 * Build failures are allowed to fail the task so CI and local builds do not
 * silently accept invalid stylesheets.
 *
 * @returns {NodeJS.ReadWriteStream}
 */
export function compileScss() {
  return gulp
    .src(SYSTEM_SCSS)
    .pipe(sass({ style: "expanded" }).on("error", sass.logError))
    .pipe(autoprefixer({ cascade: false }))
    .pipe(gulp.dest("./css"));
}

/** Watch SCSS sources and rebuild CSS when they change. */
export function watchScss() {
  return gulp.watch(SYSTEM_SCSS, compileScss);
}

export const css = gulp.series(compileScss);
export const watch = gulp.series(compileScss, watchScss);
export default watch;
