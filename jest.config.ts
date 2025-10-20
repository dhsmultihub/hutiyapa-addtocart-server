import type { Config } from 'jest';

const config: Config = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	moduleFileExtensions: ['ts', 'js', 'json'],
	rootDir: '.',
	testRegex: '.*\\.spec\\.ts$',
	moduleNameMapper: {},
};

export default config;

