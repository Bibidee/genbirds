# v0.2.17
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json

PENDING = "PENDING"
VALID = "VALID"
INVALID = "INVALID"
SUSPICIOUS = "SUSPICIOUS"
NEEDS_REVIEW = "NEEDS_REVIEW"


class GenBirdsScoreRegistry(gl.Contract):
    owner: str

    # Player profile storage
    # player address -> JSON profile
    player_profiles: TreeMap[str, str]

    # lowercase username -> player address
    username_owners: TreeMap[str, str]

    # Level storage
    # level_id -> JSON level metadata
    levels: TreeMap[str, str]

    # Attempt storage
    # attempt_id -> JSON attempt metadata
    attempts: TreeMap[str, str]

    # player address -> JSON {"ids": [attempt_id]}
    player_attempts: TreeMap[str, str]

    # level_id -> JSON {"ids": [attempt_id]}
    level_attempts: TreeMap[str, str]

    # "level_id:player" -> best score as string
    player_best: TreeMap[str, str]

    # "level_id:player" -> best attempt id
    player_best_attempt: TreeMap[str, str]

    # level_id -> best attempt id
    level_best: TreeMap[str, str]

    # level_id -> JSON {"entries": [{rank, attempt_id, player, username, score, timestamp}]}
    level_leaderboards: TreeMap[str, str]

    def __init__(self) -> None:
        self.owner = str(gl.message.sender_address)

        self.player_profiles = TreeMap[str, str]()
        self.username_owners = TreeMap[str, str]()

        self.levels = TreeMap[str, str]()
        self.attempts = TreeMap[str, str]()
        self.player_attempts = TreeMap[str, str]()
        self.level_attempts = TreeMap[str, str]()

        self.player_best = TreeMap[str, str]()
        self.player_best_attempt = TreeMap[str, str]()
        self.level_best = TreeMap[str, str]()
        self.level_leaderboards = TreeMap[str, str]()

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------

    def _sender(self) -> str:
        return str(gl.message.sender_address)

    def _user_error(self, message: str) -> None:
        raise gl.vm.UserError(message)

    def _safe_loads(self, raw: str):
        if raw is None or raw == "":
            return {}
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def _dumps(self, obj) -> str:
        return json.dumps(obj, sort_keys=True, separators=(",", ":"))

    def _to_int(self, value) -> int:
        try:
            return int(value)
        except Exception:
            return 0

    def _timestamp(self) -> int:
        try:
            return int(gl.block.timestamp)
        except Exception:
            return 0

    def _only_owner(self) -> None:
        if self._sender() != self.owner:
            self._user_error("not owner")

    def _require_non_empty(self, value: str, name: str) -> None:
        if value is None or value == "":
            self._user_error(name + " required")

    def _is_valid_verdict(self, verdict: str) -> bool:
        return verdict in {
            PENDING,
            VALID,
            INVALID,
            SUSPICIOUS,
            NEEDS_REVIEW,
        }

    def _counts_for_leaderboard(self, rec) -> bool:
        return rec.get("status") == VALID and rec.get("counts_for_leaderboard") is True

    def _append_id(self, raw: str, attempt_id: str) -> str:
        data = self._safe_loads(raw)
        ids = data.get("ids", [])

        if not isinstance(ids, list):
            ids = []

        found = False
        for existing_id in ids:
            if str(existing_id) == attempt_id:
                found = True

        if not found:
            ids.append(attempt_id)

        return self._dumps({"ids": ids})

    # -----------------------------------------------------------------------
    # Username helpers
    # -----------------------------------------------------------------------

    def _normalise_username(self, username: str) -> str:
        if username is None:
            return ""
        return username.strip().lower()

    def _clean_username(self, username: str) -> str:
        if username is None:
            return ""
        return username.strip()

    def _valid_username(self, username: str) -> bool:
        if username is None:
            return False

        clean = username.strip()
        n = len(clean)

        if n < 3 or n > 20:
            return False

        for ch in clean:
            ok = (
                ("a" <= ch <= "z")
                or ("A" <= ch <= "Z")
                or ("0" <= ch <= "9")
                or ch == "_"
                or ch == "-"
            )

            if not ok:
                return False

        return True

    def _username_for_player(self, player: str) -> str:
        if player in self.player_profiles:
            profile = self._safe_loads(self.player_profiles[player])
            return str(profile.get("username", ""))
        return ""

    # -----------------------------------------------------------------------
    # Ownership
    # -----------------------------------------------------------------------

    @gl.public.view
    def get_owner(self) -> str:
        return self.owner

    @gl.public.write
    def transfer_ownership(self, new_owner: str) -> None:
        self._only_owner()
        self._require_non_empty(new_owner, "new_owner")
        self.owner = new_owner

    # -----------------------------------------------------------------------
    # Player profile / username registry
    # -----------------------------------------------------------------------

    @gl.public.write
    def register_player(self, username: str) -> None:
        caller = self._sender()

        self._require_non_empty(username, "username")

        username_clean = self._clean_username(username)
        username_key = self._normalise_username(username_clean)

        if not self._valid_username(username_clean):
            self._user_error("invalid username")

        if caller in self.player_profiles:
            self._user_error("player already registered")

        existing_owner = ""
        if username_key in self.username_owners:
            existing_owner = self.username_owners[username_key]

        if existing_owner != "":
            self._user_error("username already taken")

        timestamp = self._timestamp()

        profile = {
            "player": caller,
            "username": username_clean,
            "username_key": username_key,
            "created_at": timestamp,
            "updated_at": timestamp,
            "total_attempts": 0,
            "valid_attempts": 0,
            "suspicious_attempts": 0,
            "invalid_attempts": 0,
        }

        self.player_profiles[caller] = self._dumps(profile)
        self.username_owners[username_key] = caller

    @gl.public.write
    def update_username(self, new_username: str) -> None:
        caller = self._sender()

        self._require_non_empty(new_username, "new_username")

        if caller not in self.player_profiles:
            self._user_error("player not registered")

        username_clean = self._clean_username(new_username)
        username_key = self._normalise_username(username_clean)

        if not self._valid_username(username_clean):
            self._user_error("invalid username")

        existing_owner = ""
        if username_key in self.username_owners:
            existing_owner = self.username_owners[username_key]

        if existing_owner != "" and existing_owner != caller:
            self._user_error("username already taken")

        profile = self._safe_loads(self.player_profiles[caller])
        old_key = str(profile.get("username_key", ""))

        if old_key != "" and old_key in self.username_owners:
            self.username_owners[old_key] = ""

        timestamp = self._timestamp()

        profile["username"] = username_clean
        profile["username_key"] = username_key
        profile["updated_at"] = timestamp

        self.player_profiles[caller] = self._dumps(profile)
        self.username_owners[username_key] = caller

    @gl.public.view
    def get_player_profile(self, player: str) -> str:
        if player in self.player_profiles:
            return self.player_profiles[player]
        return ""

    @gl.public.view
    def get_my_profile(self) -> str:
        caller = self._sender()
        if caller in self.player_profiles:
            return self.player_profiles[caller]
        return ""

    @gl.public.view
    def get_username_owner(self, username: str) -> str:
        username_key = self._normalise_username(username)

        if username_key in self.username_owners:
            return self.username_owners[username_key]

        return ""

    @gl.public.view
    def is_username_available(self, username: str) -> bool:
        username_key = self._normalise_username(username)

        if username_key == "":
            return False

        if username_key in self.username_owners:
            return self.username_owners[username_key] == ""

        return True

    # -----------------------------------------------------------------------
    # Level registry
    # -----------------------------------------------------------------------

    @gl.public.write
    def register_level(
        self,
        level_id: str,
        level_hash: str,
        max_score: u256,
        bird_count: u256,
        enemy_count: u256,
        block_count: u256,
    ) -> None:
        self._only_owner()

        self._require_non_empty(level_id, "level_id")
        self._require_non_empty(level_hash, "level_hash")

        max_score_i = int(max_score)
        bird_count_i = int(bird_count)
        enemy_count_i = int(enemy_count)
        block_count_i = int(block_count)

        if max_score_i <= 0:
            self._user_error("max_score must be positive")
        if bird_count_i <= 0:
            self._user_error("bird_count must be positive")
        if enemy_count_i <= 0:
            self._user_error("enemy_count must be positive")

        level = {
            "id": level_id,
            "hash": level_hash,
            "max_score": max_score_i,
            "bird_count": bird_count_i,
            "enemy_count": enemy_count_i,
            "block_count": block_count_i,
            "active": True,
            "created_at": self._timestamp(),
            "updated_at": self._timestamp(),
        }

        self.levels[level_id] = self._dumps(level)

        if level_id not in self.level_attempts:
            self.level_attempts[level_id] = self._dumps({"ids": []})

        if level_id not in self.level_leaderboards:
            self.level_leaderboards[level_id] = self._dumps({"entries": []})

    @gl.public.write
    def set_level_active(self, level_id: str, active: bool) -> None:
        self._only_owner()
        self._require_non_empty(level_id, "level_id")

        if level_id not in self.levels:
            self._user_error("unknown level")

        level = self._safe_loads(self.levels[level_id])
        level["active"] = active
        level["updated_at"] = self._timestamp()

        self.levels[level_id] = self._dumps(level)

    @gl.public.view
    def get_level(self, level_id: str) -> str:
        if level_id in self.levels:
            return self.levels[level_id]
        return ""

    # -----------------------------------------------------------------------
    # Attempt submission
    # -----------------------------------------------------------------------

    @gl.public.write
    def submit_attempt(
        self,
        attempt_id: str,
        level_id: str,
        level_hash: str,
        birds_used: u256,
        claimed_score: u256,
        enemies_destroyed: u256,
        blocks_destroyed: u256,
        remaining_birds: u256,
        replay_hash: str,
        physics_summary_hash: str,
    ) -> str:
        caller = self._sender()

        if caller not in self.player_profiles:
            self._user_error("register player first")

        self._require_non_empty(attempt_id, "attempt_id")
        self._require_non_empty(level_id, "level_id")
        self._require_non_empty(level_hash, "level_hash")
        self._require_non_empty(replay_hash, "replay_hash")
        self._require_non_empty(physics_summary_hash, "physics_summary_hash")

        if attempt_id in self.attempts:
            self._user_error("attempt already exists")

        birds_used_i = int(birds_used)
        claimed_score_i = int(claimed_score)
        enemies_destroyed_i = int(enemies_destroyed)
        blocks_destroyed_i = int(blocks_destroyed)
        remaining_birds_i = int(remaining_birds)

        verdict, reason = self._judge(
            level_id,
            level_hash,
            birds_used_i,
            claimed_score_i,
            enemies_destroyed_i,
            blocks_destroyed_i,
            remaining_birds_i,
            replay_hash,
            physics_summary_hash,
        )

        timestamp = self._timestamp()

        rec = {
            "id": attempt_id,
            "player": caller,
            "username": self._username_for_player(caller),
            "level_id": level_id,
            "level_hash": level_hash,
            "birds_used": birds_used_i,
            "claimed_score": claimed_score_i,
            "enemies_destroyed": enemies_destroyed_i,
            "blocks_destroyed": blocks_destroyed_i,
            "remaining_birds": remaining_birds_i,
            "replay_hash": replay_hash,
            "physics_summary_hash": physics_summary_hash,
            "status": verdict,
            "reason": reason,
            "timestamp": timestamp,
            "reviewed_by": "",
            "counts_for_leaderboard": verdict == VALID,
        }

        self.attempts[attempt_id] = self._dumps(rec)

        player_raw = ""
        if caller in self.player_attempts:
            player_raw = self.player_attempts[caller]
        self.player_attempts[caller] = self._append_id(player_raw, attempt_id)

        level_raw = ""
        if level_id in self.level_attempts:
            level_raw = self.level_attempts[level_id]
        self.level_attempts[level_id] = self._append_id(level_raw, attempt_id)

        self._recompute_player_stats(caller)

        if verdict == VALID:
            self._update_best_records(rec)

        self._update_level_leaderboard(level_id)

        return verdict

    @gl.public.view
    def get_attempt(self, attempt_id: str) -> str:
        if attempt_id in self.attempts:
            return self.attempts[attempt_id]
        return ""

    @gl.public.view
    def get_player_attempts(self, player: str) -> str:
        if player in self.player_attempts:
            return self.player_attempts[player]
        return self._dumps({"ids": []})

    @gl.public.view
    def get_my_attempts(self) -> str:
        caller = self._sender()

        if caller in self.player_attempts:
            return self.player_attempts[caller]

        return self._dumps({"ids": []})

    @gl.public.view
    def get_level_attempts(self, level_id: str) -> str:
        if level_id in self.level_attempts:
            return self.level_attempts[level_id]
        return self._dumps({"ids": []})

    # -----------------------------------------------------------------------
    # Review / flagging
    # -----------------------------------------------------------------------

    @gl.public.write
    def flag_attempt(self, attempt_id: str, reason: str) -> None:
        self._require_non_empty(attempt_id, "attempt_id")
        self._require_non_empty(reason, "reason")

        if attempt_id not in self.attempts:
            self._user_error("unknown attempt")

        rec = self._safe_loads(self.attempts[attempt_id])
        caller = self._sender()

        if caller != self.owner and caller != str(rec.get("player", "")):
            self._user_error("not authorised")

        rec["status"] = SUSPICIOUS
        rec["reason"] = "flagged: " + reason
        rec["counts_for_leaderboard"] = False

        self.attempts[attempt_id] = self._dumps(rec)

        level_id = str(rec.get("level_id", ""))
        player = str(rec.get("player", ""))

        self._recompute_best_records(level_id, player)
        self._update_level_leaderboard(level_id)
        self._recompute_player_stats(player)

    @gl.public.write
    def review_attempt(self, attempt_id: str, new_verdict: str, reason: str) -> None:
        self._only_owner()

        self._require_non_empty(attempt_id, "attempt_id")
        self._require_non_empty(reason, "reason")

        if not self._is_valid_verdict(new_verdict):
            self._user_error("bad verdict")

        if attempt_id not in self.attempts:
            self._user_error("unknown attempt")

        rec = self._safe_loads(self.attempts[attempt_id])

        rec["status"] = new_verdict
        rec["reason"] = reason
        rec["reviewed_by"] = self._sender()
        rec["counts_for_leaderboard"] = new_verdict == VALID

        self.attempts[attempt_id] = self._dumps(rec)

        level_id = str(rec.get("level_id", ""))
        player = str(rec.get("player", ""))

        self._recompute_best_records(level_id, player)
        self._update_level_leaderboard(level_id)
        self._recompute_player_stats(player)

    # -----------------------------------------------------------------------
    # Best score / leaderboard views
    # -----------------------------------------------------------------------

    @gl.public.view
    def get_player_best(self, level_id: str, player: str) -> u256:
        key = level_id + ":" + player

        if key in self.player_best:
            return u256(self._to_int(self.player_best[key]))

        return u256(0)

    @gl.public.view
    def get_player_best_attempt(self, level_id: str, player: str) -> str:
        key = level_id + ":" + player

        if key in self.player_best_attempt:
            return self.player_best_attempt[key]

        return ""

    @gl.public.view
    def get_my_best(self, level_id: str) -> u256:
        caller = self._sender()
        key = level_id + ":" + caller

        if key in self.player_best:
            return u256(self._to_int(self.player_best[key]))

        return u256(0)

    @gl.public.view
    def get_my_best_attempt(self, level_id: str) -> str:
        caller = self._sender()
        key = level_id + ":" + caller

        if key in self.player_best_attempt:
            return self.player_best_attempt[key]

        return ""

    @gl.public.view
    def get_level_best(self, level_id: str) -> str:
        if level_id in self.level_best:
            return self.level_best[level_id]

        return ""

    @gl.public.view
    def get_level_leaderboard(self, level_id: str) -> str:
        if level_id in self.level_leaderboards:
            return self.level_leaderboards[level_id]

        return self._dumps({"entries": []})

    # Alias because you keep calling it headboard.
    @gl.public.view
    def get_level_headboard(self, level_id: str) -> str:
        if level_id in self.level_leaderboards:
            return self.level_leaderboards[level_id]

        return self._dumps({"entries": []})

    # -----------------------------------------------------------------------
    # Internal leaderboard / best record logic
    # -----------------------------------------------------------------------

    def _update_best_records(self, rec) -> None:
        level_id = str(rec.get("level_id", ""))
        player = str(rec.get("player", ""))
        attempt_id = str(rec.get("id", ""))
        score = self._to_int(rec.get("claimed_score", 0))

        if level_id == "" or player == "" or attempt_id == "":
            return

        if not self._counts_for_leaderboard(rec):
            return

        player_key = level_id + ":" + player

        previous_score = 0
        if player_key in self.player_best:
            previous_score = self._to_int(self.player_best[player_key])

        if score > previous_score:
            self.player_best[player_key] = str(score)
            self.player_best_attempt[player_key] = attempt_id

        current_best_id = ""
        if level_id in self.level_best:
            current_best_id = self.level_best[level_id]

        if current_best_id == "":
            self.level_best[level_id] = attempt_id
            return

        if current_best_id not in self.attempts:
            self.level_best[level_id] = attempt_id
            return

        current_best = self._safe_loads(self.attempts[current_best_id])

        if not self._counts_for_leaderboard(current_best):
            self.level_best[level_id] = attempt_id
            return

        current_best_score = self._to_int(current_best.get("claimed_score", 0))

        if score > current_best_score:
            self.level_best[level_id] = attempt_id

    def _recompute_best_records(self, level_id: str, player: str) -> None:
        if level_id == "":
            return

        best_level_attempt = ""
        best_level_score = -1
        best_level_time = 0

        level_data = {}
        if level_id in self.level_attempts:
            level_data = self._safe_loads(self.level_attempts[level_id])

        level_ids = level_data.get("ids", [])
        if not isinstance(level_ids, list):
            level_ids = []

        for attempt_id in level_ids:
            attempt_id_str = str(attempt_id)

            if attempt_id_str in self.attempts:
                rec = self._safe_loads(self.attempts[attempt_id_str])

                if self._counts_for_leaderboard(rec):
                    score = self._to_int(rec.get("claimed_score", 0))
                    ts = self._to_int(rec.get("timestamp", 0))

                    if (
                        score > best_level_score
                        or (
                            score == best_level_score
                            and best_level_attempt != ""
                            and ts < best_level_time
                        )
                    ):
                        best_level_score = score
                        best_level_time = ts
                        best_level_attempt = attempt_id_str

        self.level_best[level_id] = best_level_attempt

        if player == "":
            return

        player_key = level_id + ":" + player
        best_player_attempt = ""
        best_player_score = -1
        best_player_time = 0

        player_data = {}
        if player in self.player_attempts:
            player_data = self._safe_loads(self.player_attempts[player])

        player_ids = player_data.get("ids", [])
        if not isinstance(player_ids, list):
            player_ids = []

        for attempt_id in player_ids:
            attempt_id_str = str(attempt_id)

            if attempt_id_str in self.attempts:
                rec = self._safe_loads(self.attempts[attempt_id_str])

                if str(rec.get("level_id", "")) == level_id and self._counts_for_leaderboard(rec):
                    score = self._to_int(rec.get("claimed_score", 0))
                    ts = self._to_int(rec.get("timestamp", 0))

                    if (
                        score > best_player_score
                        or (
                            score == best_player_score
                            and best_player_attempt != ""
                            and ts < best_player_time
                        )
                    ):
                        best_player_score = score
                        best_player_time = ts
                        best_player_attempt = attempt_id_str

        if best_player_attempt != "":
            self.player_best[player_key] = str(best_player_score)
            self.player_best_attempt[player_key] = best_player_attempt
        else:
            self.player_best[player_key] = "0"
            self.player_best_attempt[player_key] = ""

    def _update_level_leaderboard(self, level_id: str) -> None:
        if level_id == "":
            return

        level_data = {}
        if level_id in self.level_attempts:
            level_data = self._safe_loads(self.level_attempts[level_id])

        ids = level_data.get("ids", [])

        if not isinstance(ids, list):
            ids = []

        # Keep one best row per player.
        best_rows = []

        for attempt_id in ids:
            attempt_id_str = str(attempt_id)

            if attempt_id_str in self.attempts:
                rec = self._safe_loads(self.attempts[attempt_id_str])

                if self._counts_for_leaderboard(rec):
                    player = str(rec.get("player", ""))
                    score = self._to_int(rec.get("claimed_score", 0))
                    ts = self._to_int(rec.get("timestamp", 0))
                    username = str(rec.get("username", ""))

                    if username == "":
                        username = self._username_for_player(player)

                    existing_index = -1

                    for i in range(len(best_rows)):
                        if str(best_rows[i].get("player", "")) == player:
                            existing_index = i

                    row = {
                        "attempt_id": attempt_id_str,
                        "player": player,
                        "username": username,
                        "score": score,
                        "timestamp": ts,
                    }

                    if existing_index == -1:
                        best_rows.append(row)
                    else:
                        current_score = self._to_int(best_rows[existing_index].get("score", 0))
                        current_time = self._to_int(best_rows[existing_index].get("timestamp", 0))

                        if score > current_score or (score == current_score and ts < current_time):
                            best_rows[existing_index] = row

        # Selection sort into top 20.
        ranked = []
        rank = 1

        while len(best_rows) > 0 and len(ranked) < 20:
            best_index = 0
            best_score = self._to_int(best_rows[0].get("score", 0))
            best_time = self._to_int(best_rows[0].get("timestamp", 0))

            for i in range(len(best_rows)):
                score = self._to_int(best_rows[i].get("score", 0))
                ts = self._to_int(best_rows[i].get("timestamp", 0))

                # Higher score wins.
                # If tied, earlier timestamp wins.
                if score > best_score or (score == best_score and ts < best_time):
                    best_index = i
                    best_score = score
                    best_time = ts

            selected = best_rows[best_index]
            selected["rank"] = rank
            ranked.append(selected)
            best_rows.pop(best_index)
            rank = rank + 1

        self.level_leaderboards[level_id] = self._dumps({"entries": ranked})

    # -----------------------------------------------------------------------
    # Player stats recompute
    # -----------------------------------------------------------------------

    def _recompute_player_stats(self, player: str) -> None:
        if player == "":
            return

        if player not in self.player_profiles:
            return

        total = 0
        valid = 0
        suspicious = 0
        invalid = 0

        player_data = {}
        if player in self.player_attempts:
            player_data = self._safe_loads(self.player_attempts[player])

        ids = player_data.get("ids", [])

        if not isinstance(ids, list):
            ids = []

        for attempt_id in ids:
            attempt_id_str = str(attempt_id)

            if attempt_id_str in self.attempts:
                rec = self._safe_loads(self.attempts[attempt_id_str])
                status = str(rec.get("status", ""))

                total = total + 1

                if status == VALID:
                    valid = valid + 1
                elif status == SUSPICIOUS:
                    suspicious = suspicious + 1
                elif status == INVALID:
                    invalid = invalid + 1

        profile = self._safe_loads(self.player_profiles[player])

        profile["total_attempts"] = total
        profile["valid_attempts"] = valid
        profile["suspicious_attempts"] = suspicious
        profile["invalid_attempts"] = invalid
        profile["updated_at"] = self._timestamp()

        self.player_profiles[player] = self._dumps(profile)

    # -----------------------------------------------------------------------
    # Judgement
    # -----------------------------------------------------------------------

    def _judge(
        self,
        level_id: str,
        level_hash: str,
        birds_used: int,
        claimed_score: int,
        enemies_destroyed: int,
        blocks_destroyed: int,
        remaining_birds: int,
        replay_hash: str,
        physics_summary_hash: str,
    ):
        if level_id not in self.levels:
            return NEEDS_REVIEW, "level not registered"

        level = self._safe_loads(self.levels[level_id])

        if not level:
            return NEEDS_REVIEW, "level metadata corrupt"

        if level.get("active") is not True:
            return INVALID, "level inactive"

        if level_hash != level.get("hash"):
            return INVALID, "level hash mismatch"

        if replay_hash == "":
            return INVALID, "missing replay hash"

        if physics_summary_hash == "":
            return INVALID, "missing physics summary hash"

        max_birds = self._to_int(level.get("bird_count", 0))
        max_enemies = self._to_int(level.get("enemy_count", 0))
        max_blocks = self._to_int(level.get("block_count", 0))
        max_score = self._to_int(level.get("max_score", 0))

        if birds_used > max_birds:
            return INVALID, "birds_used exceeds level bird count"

        if remaining_birds > max_birds:
            return INVALID, "remaining_birds exceeds level bird count"

        if birds_used + remaining_birds > max_birds:
            return INVALID, "birds_used plus remaining_birds exceeds level bird count"

        if enemies_destroyed > max_enemies:
            return SUSPICIOUS, "enemy count exceeds level enemy count"

        if blocks_destroyed > max_blocks:
            return SUSPICIOUS, "block count exceeds level block count"

        if max_score > 0:
            tolerated_max = int(max_score * 105 / 100)

            if claimed_score > tolerated_max:
                return SUSPICIOUS, "score exceeds plausible maximum"

        if enemies_destroyed == max_enemies:
            return VALID, "completed level within bounds"

        if claimed_score > 0:
            return NEEDS_REVIEW, "partial completion requires review"

        return VALID, "within bounds"
