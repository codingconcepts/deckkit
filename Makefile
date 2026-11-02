validate_version:
ifndef VERSION
	$(error VERSION is undefined)
endif

publish: validate_version
	npm pack --dry-run

	npm version ${VERSION}
	npm publish

	git push origin main --follow-tags
