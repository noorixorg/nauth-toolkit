# Sample Capacitor

This project is an Angular 21 application integrated with Capacitor for native mobile app development.

## Project Details

- **Angular Version**: 21.0.0
- **Capacitor Version**: 8.0.0
- **App ID**: com.noorix.nauth
- **App Name**: sample-capacitor

## Development Server

To start a local development server, run:

```bash
yarn start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Building

To build the project run:

```bash
yarn build
```

This will compile your project and store the build artifacts in the `dist/sample-capacitor/browser/` directory.

## Capacitor Commands

### Sync Capacitor

After building your Angular app, sync the web assets with native platforms:

```bash
yarn cap:sync
```

This command will:
- Copy web assets to native platforms
- Update native dependencies
- Update plugin configurations

### Copy Web Assets

Copy only the web assets without updating native dependencies:

```bash
yarn cap:copy
```

### Update Native Dependencies

Update native dependencies without copying web assets:

```bash
yarn cap:update
```

### Open Native Projects

Open the iOS project in Xcode:

```bash
yarn cap:open:ios
```

Open the Android project in Android Studio:

```bash
yarn cap:open:android
```

## Running on Native Platforms

### iOS

1. Build the Angular app: `yarn build`
2. Sync Capacitor: `yarn cap:sync`
3. Open iOS project: `yarn cap:open:ios`
4. Run the app from Xcode

### Android

1. Build the Angular app: `yarn build`
2. Sync Capacitor: `yarn cap:sync`
3. Open Android project: `yarn cap:open:android`
4. Run the app from Android Studio

## Testing

To execute unit tests, use:

```bash
yarn test
```

## Additional Resources

- [Angular Documentation](https://angular.dev)
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Angular CLI Overview](https://angular.dev/tools/cli)
