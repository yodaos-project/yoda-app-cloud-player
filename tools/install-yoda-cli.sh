
curl -L https://github.com/yodaos-project/yoda-platform-tools/releases/download/v0.2.1/yoda-cli-v0.2.1-Darwin-x86_64.tar.gz > ./yoda-cli.tar.gz
mkdir -p ./yoda-cli-dir && tar xvzf ./yoda-cli.tar.gz -C ./yoda-cli-dir/

pwd
./yoda-cli-dir/yoda-cli --help

exit 0

