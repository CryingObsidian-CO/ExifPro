pub mod builtin;
pub mod loader;
pub mod manifest;

pub use builtin::get_builtin_plugin_manifests;
pub use loader::{DiscoveredPlugin, PluginLoader};
pub use manifest::{
    ConfigSchemaItem, PluginCapabilities, PluginInfo, PluginManifest, CURRENT_API_VERSION,
};
