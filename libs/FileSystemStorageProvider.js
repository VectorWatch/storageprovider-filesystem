var util = require('util');
var StorageProviderAbstract = require('vectorwatch-storageprovider-abstract');
var Promise = require('bluebird');
var fs = require('fs');
var path = require('path');

/**
 * @param directory {String}
 * @constructor
 * @augments StorageProviderAbstract
 */
function FileSystemStorageProvider(directory) {
    StorageProviderAbstract.call(this);

    this.directory = directory;
    this.authTable = {};
    this.userSettingsTable = {};
}
util.inherits(FileSystemStorageProvider, StorageProviderAbstract);

/**
 * Reads the auth from a file
 * @param credentialsKey {String}
 * @returns {Promise.<Object>}
 */
FileSystemStorageProvider.prototype.readAuthFile = function(credentialsKey) {
    var fileName = path.join(this.directory, credentialsKey + '.auth.json');
    return this.readFile(fileName);
};

/**
 * Reads the user settings from a file
 * @param channelLabel {String}
 * @returns {Promise.<Object>}
 */
FileSystemStorageProvider.prototype.readUserSettingsFile = function(credentialsKey) {
    var fileName = path.join(this.directory, credentialsKey + '.userSettings.json');
    return this.readFile(fileName);
};

/**
 * Writes the auth in a file
 * @param credentialsKey {String}
 * @param data {Object}
 * @returns {Promise}
 */
FileSystemStorageProvider.prototype.writeAuthFile = function(credentialsKey, data) {
    var fileName = path.join(this.directory, credentialsKey + '.auth.json');
    return this.writeFile(fileName, data);
};

/**
 * Writes the user settings in a file
 * @param channelLabel {String}
 * @param data {Object}
 * @returns {Promise.<Object>}
 */
FileSystemStorageProvider.prototype.writeUserSettingsFile = function(credentialsKey, data) {
    var fileName = path.join(this.directory, credentialsKey + '.userSettings.json');
    return this.writeFile(fileName, data);
};

/**
 * Removes the user settings file
 * @param channelLabel {String}
 * @returns {Promise}
 */
FileSystemStorageProvider.prototype.removeUserSettingsFile = function(credentialsKey) {
    var fileName = path.join(this.directory, credentialsKey + '.userSettings.json');
    fs.unlinkSync(fileName);
    return Promise.resolve();
};

/**
 * Reads the data from a file
 * @param fileName {String}
 * @returns {Promise<Object>}
 */
FileSystemStorageProvider.prototype.readFile = function(fileName) {
    return new Promise(function(resolve, reject) {
        fs.readFile(fileName, function(err, data) {
            if (err) {
                if (err.code == 'ENOENT') {
                    return resolve();
                }

                return reject(err);
            }

            try {
                resolve(JSON.parse(data));
            } catch (err) {
                reject(err);
            }
        });
    });
};

/**
 * Writes the data in a file
 * @param fileName {String}
 * @param data {Object}
 * @returns {Promise}
 */
FileSystemStorageProvider.prototype.writeFile = function(fileName, data) {
    return new Promise(function(resolve, reject) {
        fs.writeFile(fileName, JSON.stringify(data), function(err) {
            if (err) return reject(err);
            resolve();
        });
    });
};


/**
 * @inheritdoc
 */
FileSystemStorageProvider.prototype.storeAuthTokensAsync = function(credentialsKey, authTokens) {
    return this.writeAuthFile(credentialsKey, authTokens);
};

/**
 * @inheritdoc
 */
FileSystemStorageProvider.prototype.getAuthTokensByCredentialsKeyAsync = function(credentialsKey) {
    return this.readAuthFile(credentialsKey);
};

/**
 * @inheritdoc
 */
FileSystemStorageProvider.prototype.getAuthTokensByChannelLabelAsync = function(channelLabel) {
    return this.readUserSettingsFile(channelLabel).bind(this).then(function(userSettingsObject) {
        var credentialsKey = (userSettingsObject || {}).credentialsKey;
        if (!credentialsKey) {
            return Promise.resolve();
        }

        return this.getAuthTokensByCredentialsKeyAsync(credentialsKey);
    });
};

/**
 * @inheritdoc
 */
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

/**
 * @inheritdoc
 */
FileSystemStorageProvider.prototype.removeUserSettingsAsync = function(channelLabel) {
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

/**
 * @inheritdoc
 */
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

/**
 * @inheritdoc
 */
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