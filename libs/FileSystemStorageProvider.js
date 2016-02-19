var util = require('util');
var StorageProviderAbstract = require('vectorwatch-storageprovider-abstract');
var Promise = require('bluebird');
var fs = require('fs');
var path = require('path');

function FileSystemStorageProvider(directory) {
    StorageProviderAbstract.call(this);

    this.directory = directory;
    this.authTable = {};
    this.userSettingsTable = {};
}
util.inherits(FileSystemStorageProvider, StorageProviderAbstract);

FileSystemStorageProvider.prototype.readAuthFile = function(credentialsKey) {
    var fileName = path.join(this.directory, credentialsKey + '.auth.json');
    return this.readFile(fileName);
};

FileSystemStorageProvider.prototype.readUserSettingsFile = function(channelLabel) {
    var fileName = path.join(this.directory, credentialsKey + '.userSettings.json');
    return this.readFile(fileName);
};

FileSystemStorageProvider.prototype.writeAuthFile = function(credentialsKey, data) {
    var fileName = path.join(this.directory, credentialsKey + '.auth.json');
    return this.writeFile(fileName, data);
};

FileSystemStorageProvider.prototype.writeUserSettingsFile = function(channelLabel, data) {
    var fileName = path.join(this.directory, credentialsKey + '.userSettings.json');
    return this.readFile(fileName, data);
};

FileSystemStorageProvider.prototype.removeUserSettingsFile = function(channelLabel) {
    var fileName = path.join(this.directory, credentialsKey + '.userSettings.json');
    fs.unlinkSync(fileName);
    return Promise.resolve();
};

FileSystemStorageProvider.prototype.readFile = function(fileName) {
    return new Promise(function(resolve, reject) {
        fs.readFile(fileName, function(err, data) {
            if (err) return reject(err);

            try {
                resolve(JSON.parse(data));
            } catch (err) {
                reject(err);
            }
        });
    });
};

FileSystemStorageProvider.prototype.writeFile = function(fileName, data) {
    return new Promise(function(resolve, reject) {
        fs.writeFile(fileName, JSON.stringify(data), function(err) {
            if (err) return reject(err);
            resolve();
        });
    });
};


FileSystemStorageProvider.prototype.storeAuthTokensAsync = function(credentialsKey, authTokens) {
    return this.writeAuthFile(credentialsKey, authTokens);
};

FileSystemStorageProvider.prototype.getAuthTokensByCredentialsKeyAsync = function(credentialsKey) {
    return this.readAuthFile(credentialsKey);
};

FileSystemStorageProvider.prototype.getAuthTokensByChannelLabelAsync = function(channelLabel) {
    return this.readUserSettingsFile(channelLabel).bind(this).then(function(userSettingsObject) {
        var credentialsKey = (userSettingsObject || {}).credentialsKey;
        if (!credentialsKey) {
            return Promise.resolve();
        }

        return this.getAuthTokensByCredentialsKeyAsync(credentialsKey);
    });
};

FileSystemStorageProvider.prototype.storeUserSettingsAsync = function(channelLabel, userSettings, credentialsKey) {
    return this.readUserSettingsFile(channelLabel).bind(this).then(function(userSettingsObject) {
        if (!userSettingsObject) {
            userSettingsObject = {
                count: 0,
                userSettings: userSettings,
                credentialsKey: credentialsKey
            };
        }

        userSettingsObject.count++;

        return this.writeUserSettingsFile(channelLabel, userSettingsObject);
    });
};

FileSystemStorageProvider.prototype.removeUserSettingAsync = function(channelLabel) {
    return this.readUserSettingsFile(channelLabel).bind(this).then(function(userSettingsObject) {
        if (userSettingsObject) {
            userSettingsObject.count--;
            if (userSettingsObject.count == 0) {
                return this.removeUserSettingsFile(channelLabel);
            }
        }

        return Promise.resolve();
    });
};

FileSystemStorageProvider.prototype.getAllUserSettingsAsync = function() {
    var _this = this;
    return new Promise(function(resolve, reject) {
        fs.readdir(_this.directory, function(err, files) {
            if (err) return reject(err);
            resolve(files.filter(function(fileName) {
                return /\.userSettings\.json$/.test(fileName);
            }).map(function(fileName) {
                return fileName.match(/^(.*)\.userSettings\.json$/)[1];
            }));
        });
    }).then(function(channelLabels) {
        return Promise.all(channelLabels.map(function(channelLabel) {
            return _this.getUserSettingsAsync(channelLabel);
        }));
    });
};

FileSystemStorageProvider.prototype.getUserSettingsAsync = function(channelLabel) {
    return this.readUserSettingsFile(channelLabel).bind(this).then(function(userSettingsObject) {
        return this.readAuthFile(userSettingsObject.credentialsKey).bind(this).then(function(authTokens) {
            return {
                channelLabel: channelLabel,
                userSettings: userSettingsObject.userSettings,
                authTokens: authTokens
            };
        });
    });
};

module.exports = FileSystemStorageProvider;