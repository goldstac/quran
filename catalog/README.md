# Provided Nasheeds catalog

When running from source, the app reads `index.json` and assets from this checkout. Packaged builds fetch them from the public `development` branch of this repository. Add the MP3 and cover image to this folder, then add an entry to the `nasheeds` array:

```json
{
  "id": "example-nasheed",
  "title": "Example Nasheed",
  "munshid": "Munshid Name",
  "cover": "covers/example-nasheed.jpg",
  "audio": "audio/example-nasheed.mp3"
}
```

Use a unique lowercase ID made from letters, numbers, and hyphens, up to 55 characters. The cover filename must use that ID and end in `.jpg`, `.jpeg`, `.png`, or `.webp`. The MP3 filename must use that ID and end in `.mp3`. Keep the metadata valid JSON. Packaged builds pick up a change after it is pushed to `development`, within five minutes or immediately after Refresh is clicked. Switch the source branch back to `main` before shipping the catalog to regular app users.
