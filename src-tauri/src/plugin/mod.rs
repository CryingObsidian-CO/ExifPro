pub mod loader;
pub mod manifest;

pub use loader::{DiscoveredPlugin, PluginLoader};
pub use manifest::{
    ConfigSchemaItem, PluginCapabilities, PluginInfo, PluginManifest, CURRENT_API_VERSION,
};
