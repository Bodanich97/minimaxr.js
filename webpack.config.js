/* global __dirname */

var path = require('path');
var webpack = require('webpack');

var src = path.resolve(__dirname, 'src');
var tst = path.resolve(__dirname, 'test');
var dist = path.resolve(__dirname, './');

module.exports = {
    resolve: {
        extensions: ['', '.jsx', '.js', '.json'],
        root: path.resolve(__dirname),
        modulesDirectories: ['node_modules']
    }
};
