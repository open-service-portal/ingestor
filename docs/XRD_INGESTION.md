# XRD Ingestion
One of the main features of this plugin is the ability to create Software Templates directly from XRDs defined in your attached Kubernetes Clusters.

## Requirements
* Only Templates which are also exposed via claims are taken into account

## Best Practices
* Organize the fields in your XRD in a logical flow and order, as the order in which they are defined in the XRD, that is the direction they will be shown in the UI.
* When you have nested fields in your schema, the top level field will be shown as a header. This can be very helpful in making the UI experience smoother.
* If you are using nested fields, and the whole section is optional, the plugin searches for a boolean field named "enabled". if it exists the visibility of additional fields in that section will be conditioned on the value of enabled.
* Add descriptions to your fields in the XRD as those are all added in the form as well