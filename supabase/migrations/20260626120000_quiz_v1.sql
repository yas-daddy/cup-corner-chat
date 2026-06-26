-- Daily WC Quiz v1: 72 trivia questions over the WC26 window, 3/day.
-- Sources cross-checked against Wikipedia and fifa.com. RLS is strict on
-- quiz_questions so the correct_index column never leaves the server —
-- clients read questions through /api/public/quiz-today which strips it.

CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_date date NOT NULL,
  order_index smallint NOT NULL CHECK (order_index BETWEEN 1 AND 3),
  category text NOT NULL,
  text text NOT NULL,
  choices jsonb NOT NULL,
  correct_index smallint NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation text,
  UNIQUE (unlock_date, order_index)
);
CREATE INDEX quiz_questions_date_idx ON public.quiz_questions (unlock_date);

CREATE TABLE public.quiz_answers (
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  choice_index smallint NOT NULL CHECK (choice_index BETWEEN -1 AND 3),
  points smallint NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, question_id)
);
CREATE INDEX quiz_answers_player_idx ON public.quiz_answers (player_id);

CREATE OR REPLACE VIEW public.quiz_leaderboard AS
SELECT
  p.id AS player_id,
  p.display_name,
  p.avatar,
  COALESCE(SUM(a.points), 0)::int AS total_points,
  COUNT(*) FILTER (WHERE a.choice_index <> -1) AS answered,
  COUNT(*) FILTER (WHERE a.choice_index <> -1 AND a.points > 0) AS correct
FROM public.players p
LEFT JOIN public.quiz_answers a ON a.player_id = p.id
GROUP BY p.id, p.display_name, p.avatar;

ALTER VIEW public.quiz_leaderboard SET (security_invoker = on);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- quiz_questions has NO anon read policy — correct_index would leak.
CREATE POLICY "quiz_answers read all" ON public.quiz_answers FOR SELECT USING (true);

GRANT SELECT ON public.quiz_answers TO anon, authenticated;
GRANT SELECT ON public.quiz_leaderboard TO anon, authenticated;
GRANT ALL ON public.quiz_questions, public.quiz_answers TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_answers;

-- 72 questions, 3 per day from 2026-06-26 to 2026-07-19.
INSERT INTO public.quiz_questions (unlock_date, order_index, category, text, choices, correct_index, explanation) VALUES
-- Day 1 (Jun 26)
('2026-06-26', 1, 'winners', 'Who won the inaugural 1930 World Cup?', '["Argentina","Brazil","Italy","Uruguay"]'::jsonb, 3, 'Uruguay hosted and won the first World Cup, beating Argentina 4-2 in the final in Montevideo.'),
('2026-06-26', 2, 'scorers', 'France''s Just Fontaine scored a record 13 goals at the 1958 World Cup. Who finished second in the all-time single-tournament list with 11 goals in 1954?', '["Sándor Kocsis","Pelé","Gerd Müller","Garrincha"]'::jsonb, 0, 'Hungary''s Sándor Kocsis scored 11 in 1954. Fontaine''s 13 in 1958 still stands as the single-tournament record.'),
('2026-06-26', 3, 'moments', 'In which year did Maradona score his famous "Hand of God" goal against England?', '["1982","1986","1990","1994"]'::jsonb, 1, 'Argentina vs England, World Cup 1986 quarter-final. Four minutes after the handball, Maradona scored his "Goal of the Century" in the same match.'),

-- Day 2 (Jun 27)
('2026-06-27', 1, 'winners', 'Who won the 1934 World Cup, hosted in Italy?', '["Czechoslovakia","Hungary","Italy","Spain"]'::jsonb, 2, 'Italy beat Czechoslovakia 2-1 in extra time at the final in Rome.'),
('2026-06-27', 2, 'scorers', 'Who was the top scorer at the 1970 World Cup with 10 goals?', '["Gerd Müller","Pelé","Jairzinho","Tostão"]'::jsonb, 0, 'West Germany''s Gerd Müller won the Golden Boot with 10 goals in Mexico 1970.'),
('2026-06-27', 3, 'moments', 'Brazil suffered their heaviest WC defeat, losing 1-7 in the 2014 semi-final to which team?', '["Argentina","France","Germany","Netherlands"]'::jsonb, 2, 'Germany dismantled Brazil 7-1 in Belo Horizonte en route to winning the 2014 World Cup.'),

-- Day 3 (Jun 28)
('2026-06-28', 1, 'winners', 'Italy won back-to-back World Cups in 1934 and which other year?', '["1930","1938","1950","1954"]'::jsonb, 1, 'Italy beat Hungary 4-2 in the 1938 final in Colombes, France, becoming the first repeat champion.'),
('2026-06-28', 2, 'scorers', 'Who was the top scorer at the 1986 World Cup with 6 goals?', '["Diego Maradona","Careca","Gary Lineker","Emilio Butragueño"]'::jsonb, 2, 'England''s Gary Lineker won the Golden Boot at Mexico 1986 with six goals.'),
('2026-06-28', 3, 'moments', 'Pelé became the youngest goalscorer in WC history at what age?', '["17","18","19","20"]'::jsonb, 0, 'Pelé was 17 years and 239 days old when he scored against Wales in 1958.'),

-- Day 4 (Jun 29)
('2026-06-29', 1, 'winners', 'Uruguay shocked Brazil 2-1 in the 1950 final round at the Maracanã. Who scored Uruguay''s winning goal?', '["Alcides Ghiggia","Juan Schiaffino","Obdulio Varela","Atilio García"]'::jsonb, 0, 'Alcides Ghiggia''s 79th-minute strike sealed the so-called "Maracanaço".'),
('2026-06-29', 2, 'records', 'Who is the only player to win three World Cups?', '["Diego Maradona","Pelé","Franz Beckenbauer","Lionel Messi"]'::jsonb, 1, 'Pelé won in 1958, 1962 and 1970 with Brazil — still the only player to lift the trophy three times.'),
('2026-06-29', 3, 'iran', 'In which year did Iran first qualify for a World Cup?', '["1974","1978","1982","1990"]'::jsonb, 1, 'Iran debuted at Argentina 1978 under coach Heshmat Mohajerani.'),

-- Day 5 (Jun 30)
('2026-06-30', 1, 'winners', '"The Miracle of Bern" was who beating an unbeaten Hungary 3-2 in the 1954 final?', '["Brazil","Italy","Sweden","West Germany"]'::jsonb, 3, 'West Germany came back from 0-2 down to win 3-2 against a Hungary side unbeaten in 31 matches.'),
('2026-06-30', 2, 'scorers', 'Who was the top scorer at the 1998 World Cup with 6 goals?', '["Christian Vieri","Davor Šuker","Gabriel Batistuta","Ronaldo"]'::jsonb, 1, 'Croatia''s Davor Šuker won the Golden Boot at France 1998 with six goals.'),
('2026-06-30', 3, 'iran', 'Iran''s first ever World Cup goal in 1978 was scored against which team?', '["Netherlands","Peru","Scotland","Tunisia"]'::jsonb, 2, 'Iraj Danaeifard equalised for Iran in a 1-1 draw with Scotland — Iran''s first World Cup goal.'),

-- Day 6 (Jul 1)
('2026-07-01', 1, 'winners', 'Who won the 1958 World Cup, with a 17-year-old Pelé scoring twice in the final?', '["Brazil","France","Sweden","West Germany"]'::jsonb, 0, 'Brazil beat hosts Sweden 5-2 in Solna for their first title.'),
('2026-07-01', 2, 'wc26', 'How many host countries does the 2026 World Cup have?', '["1","2","3","4"]'::jsonb, 2, 'Canada, Mexico and the United States co-host — a first for a men''s World Cup.'),
('2026-07-01', 3, 'tidbits', 'The 1986 World Cup in Mexico had a mascot that was an anthropomorphic what?', '["Cactus","Jalapeño pepper","Sombrero","Sun"]'::jsonb, 1, 'Pique was a jalapeño pepper wearing a sombrero — a nod to Mexican cuisine and dress.'),

-- Day 7 (Jul 2)
('2026-07-02', 1, 'winners', 'Who won the 1966 World Cup, their only World Cup title?', '["England","Italy","Portugal","West Germany"]'::jsonb, 0, 'England beat West Germany 4-2 at Wembley after extra time. Geoff Hurst''s hat-trick remains the only one in a final by an Englishman.'),
('2026-07-02', 2, 'scorers', 'Who was the top scorer at the 2002 World Cup with 8 goals?', '["Christian Vieri","Miroslav Klose","Rivaldo","Ronaldo"]'::jsonb, 3, 'Brazil''s Ronaldo won the Golden Boot at Korea/Japan 2002 with eight goals, including both in the final.'),
('2026-07-02', 3, 'moments', 'Roger Milla, the oldest WC goalscorer, was how old when he scored at USA 1994?', '["38","40","42","44"]'::jsonb, 2, 'Milla was 42 years, 1 month and 8 days old when he scored against Russia — a record that still stands.'),

-- Day 8 (Jul 3)
('2026-07-03', 1, 'winners', 'Argentina won their first World Cup in 1978 — but who captained their second title in 1986?', '["Daniel Passarella","Diego Maradona","Jorge Burruchaga","Mario Kempes"]'::jsonb, 1, 'Maradona captained Argentina to victory in Mexico 1986, leaving the trophy raised over his head at the Azteca.'),
('2026-07-03', 2, 'scorers', 'Who was the top scorer at the 2006 World Cup with 5 goals?', '["Hernán Crespo","Lukas Podolski","Miroslav Klose","Thierry Henry"]'::jsonb, 2, 'Germany''s Miroslav Klose won the Golden Boot at home with five goals.'),
('2026-07-03', 3, 'iran', 'Iran''s historic 2-1 win over which country at the 1998 World Cup is still cited as a major upset?', '["Germany","United States","Yugoslavia","Mexico"]'::jsonb, 1, 'Iran beat the USA 2-1 in Lyon — their first ever World Cup victory. Hamid Estili and Mehdi Mahdavikia scored.'),

-- Day 9 (Jul 4)
('2026-07-04', 1, 'winners', 'Who won the 1998 World Cup on home soil?', '["Brazil","Croatia","France","Italy"]'::jsonb, 2, 'France beat Brazil 3-0 in the final at the Stade de France. Zinedine Zidane scored twice.'),
('2026-07-04', 2, 'records', 'Who scored the most goals across all World Cups, after the 2022 tournament?', '["Gerd Müller","Just Fontaine","Lionel Messi","Miroslav Klose"]'::jsonb, 3, 'Miroslav Klose finished his WC career with 16 goals. Lionel Messi has since surpassed him during the 2026 cycle.'),
('2026-07-04', 3, 'tidbits', 'Which 2010 official match ball was famously criticised by players for unpredictable flight?', '["Brazuca","Fevernova","Jabulani","Teamgeist"]'::jsonb, 2, 'Goalkeepers were especially vocal about the Jabulani''s erratic movement at altitude in South Africa.'),

-- Day 10 (Jul 5)
('2026-07-05', 1, 'winners', 'Brazil''s 2002 World Cup triumph saw them beat which team 2-0 in the final?', '["Germany","South Korea","Spain","Turkey"]'::jsonb, 0, 'Brazil beat Germany 2-0 in Yokohama with two goals from Ronaldo.'),
('2026-07-05', 2, 'scorers', 'Who was the top scorer at the 2014 World Cup with 6 goals?', '["James Rodríguez","Lionel Messi","Neymar","Thomas Müller"]'::jsonb, 0, 'Colombia''s James Rodríguez won the Golden Boot at Brazil 2014, including a famous volley vs Uruguay.'),
('2026-07-05', 3, 'wc26', 'The 2026 World Cup final will be played at MetLife Stadium in which US state?', '["California","Florida","New Jersey","New York"]'::jsonb, 2, 'MetLife Stadium is in East Rutherford, New Jersey, just across the Hudson from New York City.'),

-- Day 11 (Jul 6)
('2026-07-06', 1, 'winners', 'Spain won their only World Cup in 2010, beating which side 1-0 in the final?', '["Germany","Netherlands","Paraguay","Uruguay"]'::jsonb, 1, 'Andrés Iniesta scored deep in extra time vs the Netherlands at Soccer City, Johannesburg.'),
('2026-07-06', 2, 'scorers', 'Who was the top scorer at the 2018 World Cup with 6 goals?', '["Antoine Griezmann","Cristiano Ronaldo","Harry Kane","Romelu Lukaku"]'::jsonb, 2, 'England''s Harry Kane won the Golden Boot at Russia 2018, including a hat-trick against Panama.'),
('2026-07-06', 3, 'moments', 'Hakan Şükür scored the fastest goal in World Cup history. In how many seconds?', '["8","11","15","22"]'::jsonb, 1, 'Şükür scored after just 11 seconds in Turkey vs South Korea (3rd place playoff) at Korea/Japan 2002.'),

-- Day 12 (Jul 7)
('2026-07-07', 1, 'winners', 'Who won the 2022 World Cup in Qatar?', '["Argentina","Brazil","Croatia","France"]'::jsonb, 0, 'Argentina beat France 4-2 on penalties after a 3-3 draw at Lusail Stadium — Messi''s long-awaited first WC title.'),
('2026-07-07', 2, 'scorers', 'Who was the top scorer at the 2022 World Cup with 8 goals?', '["Julian Álvarez","Kylian Mbappé","Lionel Messi","Olivier Giroud"]'::jsonb, 1, 'Mbappé won the Golden Boot at Qatar 2022, including a hat-trick in the final.'),
('2026-07-07', 3, 'iran', 'Which coach has led Iran at four different World Cups?', '["Branko Ivanković","Carlos Queiroz","Heshmat Mohajerani","Jalal Talebi"]'::jsonb, 1, 'Carlos Queiroz has coached Iran at 2014, 2018, 2022 and 2026 — by far the longest WC run for any Team Melli boss.'),

-- Day 13 (Jul 8)
('2026-07-08', 1, 'scorers', 'Who was the top scorer at the 1966 World Cup with 9 goals, nicknamed "The Black Panther"?', '["Bobby Charlton","Eusébio","Ferenc Bene","Franz Beckenbauer"]'::jsonb, 1, 'Portugal''s Eusébio won the Golden Boot at England 1966, including four against North Korea in a 5-3 comeback.'),
('2026-07-08', 2, 'records', 'Which country has appeared at every single World Cup, 1930-2026?', '["Argentina","Brazil","Germany","Italy"]'::jsonb, 1, 'Brazil is the only nation to have appeared in all 23 World Cup tournaments.'),
('2026-07-08', 3, 'tidbits', 'The iconic black-and-white 32-panel Telstar match ball debuted at which World Cup?', '["1966","1970","1974","1978"]'::jsonb, 1, 'Adidas''s Telstar was used at Mexico 1970, the first WC broadcast in colour worldwide — the design helped it stand out on TV.'),

-- Day 14 (Jul 9)
('2026-07-09', 1, 'scorers', 'Italy''s Paolo Rossi won the 1982 Golden Boot with 6 goals — including a hat-trick against which team in the second round?', '["Argentina","Brazil","Poland","West Germany"]'::jsonb, 1, 'Rossi''s hat-trick in Italy''s 3-2 win over Brazil in Barcelona is one of the great individual performances in WC history.'),
('2026-07-09', 2, 'wc26', 'The 2026 World Cup opening match will be played at Estadio Azteca in which city?', '["Guadalajara","Mexico City","Monterrey","Tijuana"]'::jsonb, 1, 'The opening match is at the storied Estadio Azteca in Mexico City — the only stadium to host two WC finals (1970, 1986).'),
('2026-07-09', 3, 'moments', 'Geoff Hurst''s hat-trick in the 1966 final was scored against which country?', '["Argentina","Brazil","Hungary","West Germany"]'::jsonb, 3, 'England beat West Germany 4-2 after extra time at Wembley. Hurst was the only player with a WC final hat-trick until Mbappé in 2022.'),

-- Day 15 (Jul 10)
('2026-07-10', 1, 'scorers', 'Mario Kempes won the 1978 Golden Boot with 6 goals — for which country?', '["Argentina","Brazil","Italy","Netherlands"]'::jsonb, 0, 'Kempes was a star of Argentina''s first WC title and scored twice in the final against the Netherlands.'),
('2026-07-10', 2, 'records', 'Just Fontaine scored a record 13 goals at a single World Cup — in which year?', '["1950","1954","1958","1962"]'::jsonb, 2, 'Fontaine scored 13 in 6 matches at Sweden 1958 — a single-tournament record that has never come close to being beaten.'),
('2026-07-10', 3, 'iran', 'In which year did Iran achieve their best ever group stage performance, finishing with 1W-1D-1L?', '["1998","2006","2018","2022"]'::jsonb, 2, 'Iran beat Morocco 1-0, lost narrowly to Spain 0-1, and drew 1-1 with Portugal at Russia 2018.'),

-- Day 16 (Jul 11)
('2026-07-11', 1, 'records', 'The biggest WC match win came in 1982. Hungary 10, who 1?', '["El Salvador","Honduras","Kuwait","New Zealand"]'::jsonb, 0, 'Hungary thrashed El Salvador 10-1 in their group at Spain 1982.'),
('2026-07-11', 2, 'moments', 'Until Mbappé equalled the feat in 2022, only one player had scored a hat-trick in a WC final. Who?', '["Diego Maradona","Geoff Hurst","Pelé","Vavá"]'::jsonb, 1, 'Geoff Hurst''s hat-trick at Wembley in 1966 stood alone for 56 years.'),
('2026-07-11', 3, 'wc26', 'How many teams are competing in the expanded 2026 World Cup?', '["32","40","48","64"]'::jsonb, 2, 'The 2026 World Cup is the first to use the new 48-team format, up from 32.'),

-- Day 17 (Jul 12)
('2026-07-12', 1, 'records', 'Which nation holds the longest current WC unbeaten run, with 14 matches between 2014 and 2026?', '["Argentina","Brazil","Germany","Netherlands"]'::jsonb, 3, 'The Netherlands'' unbeaten run reached 14 matches at the start of the 2026 World Cup.'),
('2026-07-12', 2, 'iran', 'Iran''s biggest WC defeat came at the 2022 group stage. The score was 2-6 against which team?', '["England","Spain","United States","Wales"]'::jsonb, 0, 'Iran lost 6-2 to England in their opening match at Qatar 2022.'),
('2026-07-12', 3, 'tidbits', 'The 1998 World Cup mascot was a rooster in French colours. What was its name?', '["Ciao","Footix","Naranjito","Striker"]'::jsonb, 1, 'Footix — the rooster (Gallic symbol) — was the mascot at France 1998.'),

-- Day 18 (Jul 13)
('2026-07-13', 1, 'hosts', 'The Maracanã hosted the WC final in 1950 — and which other year?', '["1994","2002","2010","2014"]'::jsonb, 3, 'The Maracanã hosted the 2014 final, where Germany beat Argentina 1-0 in extra time.'),
('2026-07-13', 2, 'moments', 'Zidane''s infamous 2006 final headbutt struck which Italian defender?', '["Fabio Cannavaro","Gianluca Zambrotta","Marco Materazzi","Andrea Pirlo"]'::jsonb, 2, 'Zidane head-butted Materazzi''s chest in extra time and was sent off. Italy went on to win on penalties.'),
('2026-07-13', 3, 'wc26', 'How many total matches will be played at the expanded 2026 World Cup?', '["64","80","104","128"]'::jsonb, 2, '104 matches: 72 group-stage games plus 32 in the new R32 → R16 → QF → SF → F + 3rd place knockout bracket.'),

-- Day 19 (Jul 14)
('2026-07-14', 1, 'hosts', 'The Estadio Azteca hosted the WC final in 1970 — and which other year?', '["1974","1982","1986","1990"]'::jsonb, 2, 'Mexico City''s Azteca hosted the famous 1986 final where Argentina beat West Germany 3-2.'),
('2026-07-14', 2, 'iran', 'Iran''s most-capped WC player Ehsan Hajsafi made his WC debut at which tournament?', '["2010","2014","2018","2022"]'::jsonb, 1, 'Hajsafi played at Brazil 2014, Russia 2018, Qatar 2022 and now USA/Mex/Can 2026.'),
('2026-07-14', 3, 'records', 'The biggest score in a WC final remains a 5-2 win in 1958. Brazil beat which side?', '["Czechoslovakia","Italy","Sweden","West Germany"]'::jsonb, 2, 'Brazil beat hosts Sweden 5-2 in Solna at the 1958 final.'),

-- Day 20 (Jul 15)
('2026-07-15', 1, 'hosts', 'The 1994 World Cup final was played at the Rose Bowl in which US state?', '["California","Florida","New Jersey","Texas"]'::jsonb, 0, 'Pasadena, California hosted the final — Brazil beat Italy on penalties after a 0-0 draw.'),
('2026-07-15', 2, 'moments', 'The "Miracle of Bern" was West Germany''s 1954 final comeback win against an unbeaten Hungary, then on a streak of how many games unbeaten?', '["18","23","31","40"]'::jsonb, 2, 'Hungary entered the final unbeaten in 31 international matches — and lost 3-2 to West Germany.'),
('2026-07-15', 3, 'tidbits', 'The 2006 World Cup official match ball was named what?', '["Brazuca","Jabulani","Teamgeist","Tricolore"]'::jsonb, 2, 'Adidas''s Teamgeist had 14 panels — the first WC ball to drop from the traditional 32.'),

-- Day 21 (Jul 16)
('2026-07-16', 1, 'hosts', 'The 2010 World Cup, held in South Africa, had its final at Soccer City Stadium in which city?', '["Cape Town","Durban","Johannesburg","Pretoria"]'::jsonb, 2, 'Soccer City in Johannesburg hosted the 2010 final — Spain 1, Netherlands 0 (a.e.t.).'),
('2026-07-16', 2, 'iran', 'Iran''s win over Wales 2-0 at Qatar 2022 was their first ever WC clean sheet. The match was in which group?', '["Group A","Group B","Group C","Group D"]'::jsonb, 1, 'Iran were in Group B with England, USA and Wales. Their 2-0 win over Wales was sealed in stoppage time.'),
('2026-07-16', 3, 'wc26', 'Which of these Canadian cities is a 2026 host?', '["Calgary","Montreal","Ottawa","Toronto"]'::jsonb, 3, 'The two Canadian hosts are Toronto and Vancouver.'),

-- Day 22 (Jul 17)
('2026-07-17', 1, 'hosts', 'The 2018 World Cup was held in which country?', '["Poland","Russia","Turkey","Ukraine"]'::jsonb, 1, 'Russia hosted, with the final at the Luzhniki Stadium in Moscow. France beat Croatia 4-2.'),
('2026-07-17', 2, 'moments', 'Brazil''s 1970 World Cup-winning side beat which team 4-1 in the final?', '["England","Italy","Netherlands","West Germany"]'::jsonb, 1, 'Brazil beat Italy 4-1 at the Azteca to lift their third World Cup. The side is widely considered one of the greatest of all time.'),
('2026-07-17', 3, 'wc26', 'The 2026 tournament runs from June 11 to which date?', '["July 12","July 19","July 26","August 2"]'::jsonb, 1, 'The final is on July 19, 2026 at MetLife Stadium.'),

-- Day 23 (Jul 18)
('2026-07-18', 1, 'hosts', 'The 2022 World Cup final was held at Lusail Stadium in which country?', '["Oman","Qatar","Saudi Arabia","United Arab Emirates"]'::jsonb, 1, 'Lusail Stadium, just north of Doha, hosted the 2022 final.'),
('2026-07-18', 2, 'records', 'The longest WC winning streak, with 11 consecutive wins between 2002 and 2006, belongs to which country?', '["Brazil","France","Germany","Spain"]'::jsonb, 0, 'Brazil rattled off 11 consecutive WC match wins on their way to and beyond their 2002 title.'),
('2026-07-18', 3, 'moments', 'The 1994 World Cup final ended 0-0 and was decided on penalties for the first time at a WC. Who won?', '["Argentina","Brazil","Italy","Sweden"]'::jsonb, 1, 'Brazil beat Italy 3-2 on penalties at the Rose Bowl, Pasadena — Roberto Baggio''s skied spot-kick deciding it.'),

-- Day 24 (Jul 19, Final)
('2026-07-19', 1, 'wc26', 'The official mascot for the United States at the 2026 World Cup is what?', '["Clutch","Glory","Liberty","Star"]'::jsonb, 0, 'Clutch is the bald eagle representing the USA. Mexico has Zayu (jaguar) and Canada has Maple (moose).'),
('2026-07-19', 2, 'tidbits', 'The 2026 official match ball is named "Trionda". The name refers to:', '["Past World Cups","The continent of North America","The three host nations","The original Telstar design"]'::jsonb, 2, '"Trionda" — three waves — is a nod to Canada, Mexico and the USA co-hosting.'),
('2026-07-19', 3, 'moments', 'The 1950 final round saw Brazil''s shock 2-1 loss at the Maracanã, known as the "Maracanazo". Who beat them?', '["Argentina","Spain","Sweden","Uruguay"]'::jsonb, 3, 'Uruguay beat Brazil 2-1 in front of an estimated 200,000 spectators at the Maracanã. Alcides Ghiggia scored the winner.');
