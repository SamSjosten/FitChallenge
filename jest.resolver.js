// Custom resolver to handle @/ path aliases
const path = require("path");

module.exports = (request, options) => {
  // Handle @/app/* paths
  if (request.startsWith("@/app/")) {
    const relativePath = request.replace("@/app/", "");
    const absolutePath = path.resolve(
      options.rootDir || process.cwd(),
      "app",
      relativePath,
    );
    return options.defaultResolver(absolutePath, options);
  }

  // Handle @/* paths (src directory)
  if (request.startsWith("@/")) {
    const relativePath = request.replace("@/", "");
    const absolutePath = path.resolve(
      options.rootDir || process.cwd(),
      "src",
      relativePath,
    );
    return options.defaultResolver(absolutePath, options);
  }

  // Default resolution
  return options.defaultResolver(request, options);
};
