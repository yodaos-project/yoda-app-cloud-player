#!/usr/bin/env bash

function get_value_by_name() {
  python3 -c "import sys, json; print(json.load(sys.stdin)['$1'])"
}

function acquire_device() {
  local RESP=`curl -XPOST \
  	-H 'Content-Type: application/json' \
	-d '{"pcName":"rokid","systemVersion":8,"customData":"yodaos-unit-test"}' \
	$UNIVERSE_URL/require`
  local DEVICE_SN=`echo $RESP | get_value_by_name 'sn'`
  echo $DEVICE_SN 
}

function release_device() {
  local RESP=`curl -XPOST \
	-H 'Content-Type: application/json' \
	-d "{\"sn\":\"$1\"}" \
	$UNIVERSE_URL/release`
  echo $RESP | get_value_by_name 'message'
}

SN="None"
ACQUIRE_COUNT=0
MAX_TRIES=10

while [ $SN == "None" ]; do
  SN=`acquire_device`
  echo "Acquire device returns $SN"

  if [ $ACQUIRE_COUNT -gt 0 ]; then
    sleep 1 # just wait for 1s when acquiring device
  fi
  if [ $ACQUIRE_COUNT -eq $MAX_TRIES ]; then
    echo "try $MAX_TRIES times and failed to find target device"
    exit 1
  fi
  ACQUIRE_COUNT=$(($ACQUIRE_COUNT + 1))
done

if [ $SN != "None" ]; then
  echo "found $SN available"
  release_device "$SN"
fi

