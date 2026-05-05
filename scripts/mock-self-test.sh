cat > /tmp/errantry-mock-script.txt <<'EOF'
echo using --help to discover commands
echo done
EOF
exec node packages/cli/dist/bin/errantry.js run \
  scenarios/self-test/help-invoked.yaml \
  --mock /tmp/errantry-mock-script.txt
